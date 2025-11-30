
export interface Env {
    POLAR_ACCESS_TOKEN: string;
    POLAR_ORGANIZATION_ID: string;
}

export default {
    async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
        // Handle CORS
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        if (request.method !== "POST") {
            return new Response("Method Not Allowed", { status: 405 });
        }

        const url = new URL(request.url);

        if (url.pathname === "/verify") {
            try {
                const body = await request.json() as { licenseKey: string };
                const { licenseKey } = body;

                if (!licenseKey) {
                    return new Response(JSON.stringify({ error: "License key is required" }), {
                        status: 400,
                        headers: {
                            "Content-Type": "application/json",
                            "Access-Control-Allow-Origin": "*"
                        },
                    });
                }

                // Mock validation if no env vars (for dev/demo purposes)
                if (!env.POLAR_ACCESS_TOKEN) {
                    // Simulate a valid key for testing if it starts with "test_"
                    if (licenseKey.startsWith("test_")) {
                        return new Response(JSON.stringify({ valid: true, plan: "pro" }), {
                            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                        });
                    }
                }

                // Real Polar.sh API call
                // Docs: https://docs.polar.sh/api-reference/license-keys/validate
                const response = await fetch("https://api.polar.sh/v1/license-keys/validate", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${env.POLAR_ACCESS_TOKEN}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        key: licenseKey,
                        organization_id: env.POLAR_ORGANIZATION_ID,
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Polar API Error:", errorText);
                    return new Response(JSON.stringify({ valid: false, error: "Validation failed upstream" }), {
                        status: 200, // Return 200 with valid: false
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                    });
                }

                const data = await response.json() as any;

                // Check if key is valid and active
                // Polar response structure might vary, adjusting based on standard expectations
                const isValid = data.status === "active";

                return new Response(JSON.stringify({ valid: isValid, ...data }), {
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                });

            } catch (e) {
                return new Response(JSON.stringify({ error: "Internal Server Error" }), {
                    status: 500,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                });
            }
        }

        return new Response("Not Found", { status: 404 });
    },
};
