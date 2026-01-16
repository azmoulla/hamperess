// FILE: api/address-proxy.js
export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).setHeader('Allow', 'GET').end('Method Not Allowed');
    }

    const { term, id } = req.query;
    const apiKey = process.env.GETADDRESS_API_KEY;

    // Safety Check: Ensure API key exists in Vercel Environment Variables
    if (!apiKey) {
        console.error("Address Proxy Error: GETADDRESS_API_KEY is missing.");
        return res.status(500).json({ error: 'Address service is not configured.' });
    }

    try {
        // ==========================================
        // CASE A: Autocomplete (Search by Term)
        // ==========================================
        if (term) {
            const apiUrl = `https://api.getAddress.io/autocomplete/${encodeURIComponent(term)}?api-key=${apiKey}`;
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (!response.ok) {
                return res.status(response.status).json({ error: data.message || `API Error: ${response.statusText}` });
            }
            // Return just the suggestions array, matching original logic
            return res.status(200).json(data.suggestions);
        }

        // ==========================================
        // CASE B: Get Details (Fetch by ID)
        // ==========================================
        if (id) {
            const apiUrl = `https://api.getAddress.io/get/${id}?api-key=${apiKey}`;
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (!response.ok) {
                return res.status(response.status).json({ error: data.message || `API Error: ${response.statusText}` });
            }
            // Return the full address object
            return res.status(200).json(data);
        }

        // ==========================================
        // Fallback: Missing Parameters
        // ==========================================
        return res.status(400).json({ error: 'Missing required parameters: Provide "term" for search or "id" for details.' });

    } catch (error) {
        console.error('Address Proxy API Error:', error);
        return res.status(500).json({ error: 'Failed to communicate with address service.' });
    }
}
