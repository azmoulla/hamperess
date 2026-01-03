// FILE: api/address-autocomplete.js
export default async function handler(req, res) {
    const { term } = req.query;
    if (!term) {
        return res.status(400).json({ error: 'Search term is required.' });
    }

    const apiKey = process.env.GETADDRESS_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Address service is not configured.' });
    }

    try {
        const apiUrl = `https://api.getAddress.io/autocomplete/${encodeURIComponent(term)}?api-key=${apiKey}`;
        const apiResponse = await fetch(apiUrl);
        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            // Use the status code from the API's response
            return res.status(apiResponse.status).json({ error: `API Error: ${apiResponse.statusText}` });
        }

        res.status(200).json(data.suggestions);

    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch address suggestions.' });
    }
}