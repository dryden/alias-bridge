import { logger } from './logger';

export interface LicenseResponse {
    valid: boolean;
    plan?: string;
    error?: string;
}

const POLAR_API_URL = 'https://api.polar.sh/v1/customer-portal/license-keys/activate';
const POLAR_VALIDATE_API_URL = 'https://api.polar.sh/v1/customer-portal/license-keys/validate';
const ORGANIZATION_ID = '0a292b2d-fb35-42c6-905a-8501d644f330'; // TODO: Replace with your Polar Organization ID

export const verifyLicense = async (key: string): Promise<LicenseResponse> => {


    try {
        // Get or create a unique instance ID for this extension installation
        let instanceId = await new Promise<string>((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['instanceId'], (result) => {
                    if (result.instanceId) {
                        resolve(result.instanceId as string);
                    } else {
                        const newId = crypto.randomUUID();
                        chrome.storage.local.set({ instanceId: newId });
                        resolve(newId);
                    }
                });
            } else {
                // Fallback for dev/browser env without extension context
                let id = localStorage.getItem('instanceId');
                if (!id) {
                    id = crypto.randomUUID();
                    localStorage.setItem('instanceId', id);
                }
                resolve(id);
            }
        });

        const response = await fetch(POLAR_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: key,
                organization_id: ORGANIZATION_ID,
                label: `extension-${instanceId}`
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            logger.error('license', 'Polar API Error:', response.status, JSON.stringify(errorData));

            if (response.status === 404) {
                return { valid: false, error: 'License key not found' };
            }
            if (response.status === 403) {
                // Return the specific detail from Polar if available (e.g. "NotPermitted")
                const detail = errorData.detail || '';
                // Check if specific error asking to use validate endpoint
                if (detail.includes('validate endpoint') || detail.includes('does not support activations')) {
                    logger.info('license', 'Key does not support activation, falling back to validation');
                    return await validateOnly(key, ORGANIZATION_ID);
                }
                return { valid: false, error: detail || 'Activation limit reached or not supported' };
            }

            // Also check 400 bad request just in case
            if (response.status === 400) {
                const detail = errorData.detail || errorData.error || '';
                if (detail.includes('validate endpoint') || detail.includes('does not support activations')) {
                    logger.info('license', 'Key does not support activation, falling back to validation');
                    return await validateOnly(key, ORGANIZATION_ID);
                }
            }

            return { valid: false, error: errorData.detail || errorData.error || 'Verification failed' };
        }

        const data = await response.json();

        // If we get a valid response with a license_key object, it's valid
        if (data && data.license_key) {
            return { valid: true, plan: 'pro' };
        }

        return { valid: false, error: 'Invalid license' };

    } catch (error) {
        logger.error('license', 'License verification failed:', error);
        return { valid: false, error: 'Verification failed' };
    }
};

const validateOnly = async (key: string, organizationId: string): Promise<LicenseResponse> => {
    try {
        const response = await fetch(POLAR_VALIDATE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: key,
                organization_id: organizationId,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            logger.error('license', 'Polar Validate API Error:', response.status, JSON.stringify(errorData));
            return { valid: false, error: errorData.detail || errorData.error || 'Validation failed' };
        }

        const data = await response.json();
        // If we get a valid response with a license_key object, it's valid
        // Validate endpoint returns logic slightly different, checking if "id" or specific fields exist is usually enough,
        // but based on API docs usually it returns the license object if valid.
        // Assuming same structure for success as we care about existence.
        if (data && (data.id || data.key)) {
            return { valid: true, plan: 'pro' };
        }

        return { valid: false, error: 'Invalid license' };
    } catch (error) {
        logger.error('license', 'License validation fallback failed:', error);
        return { valid: false, error: 'Validation failed' };
    }
};
