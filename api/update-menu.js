// FILE: api/update-menu.js
import { promises as fs } from 'fs';
import path from 'path';
import { verifyAdmin } from './_lib/firebase-admin-helper.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!await verifyAdmin(req)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const newMenuData = req.body;

        // Ensure the data is a valid JSON string before writing
        JSON.parse(JSON.stringify(newMenuData)); 
        
        // Vercel serverless functions run from the project root
        const filePath = path.join(process.cwd(), 'public', 'data', 'Header_nav.json');
        
        // Write the new content to the file
        await fs.writeFile(filePath, JSON.stringify(newMenuData, null, 2)); // Using null, 2 for pretty-printing

        res.status(200).json({ success: true, message: 'Menu updated successfully.' });

    } catch (error) {
        console.error('Error updating menu file:', error);
        if (error instanceof SyntaxError) {
            return res.status(400).json({ error: 'Invalid JSON format provided.' });
        }
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}