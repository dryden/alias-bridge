
export interface LicenseResponse {
    valid: boolean;
    plan?: string;
    error?: string;
}

// In production, this should point to your deployed worker URL
// For local dev, we might need to point to localhost:8787 but Chrome Extensions have trouble with http/localhost sometimes due to CSP.
// We will assume the user runs the backend locally on 8787 for now.
const API_URL = 'http://localhost:8787';

export const verifyLicense = async (key: string): Promise<LicenseResponse> => {
    try {
        const response = await fetch(`${API_URL}/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ licenseKey: key }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        return await response.json();
    } catch (error) {
        console.error('License verification failed:', error);
        return { valid: false, error: 'Verification failed' };
    }
};
