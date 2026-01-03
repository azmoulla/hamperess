// FILE: api/get-address-by-id.js
export default async function handler(req, res) {
    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ error: 'Address ID is required.' });
    }

    const apiKey = process.env.GETADDRESS_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Address service is not configured.' });
    }

    try {
        const apiUrl = `https://api.getAddress.io/get/${id}?api-key=${apiKey}`;
        const apiResponse = await fetch(apiUrl);
        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            return res.status(apiResponse.status).json({ error: `API Error: ${apiResponse.statusText}` });
        }
        
        // Return the full, detailed address object
        res.status(200).json(data);

    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve full address.' });
    }
}