const BASE_URL = 'https://app.addy.io/api/v1';

export interface AddyAccountDetails {
    id: string;
    username: string;
    // Add other fields as needed
}

export const verifyToken = async (token: string): Promise<AddyAccountDetails> => {
    const response = await fetch(`${BASE_URL}/account-details`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error('Invalid token or network error');
    }

    const data = await response.json();
    return data.data; // Addy API usually wraps response in 'data'
};
