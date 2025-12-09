import { logger } from './logger';

export interface LicenseResponse {
    valid: boolean;
    plan?: string;
    error?: string;
}

const POLAR_API_URL = 'https://api.polar.sh/v1/customer-portal/license-keys/activate';
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
                return { valid: false, error: errorData.detail || 'Activation limit reached or not supported' };
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
