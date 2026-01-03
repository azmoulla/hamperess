import { db, verifyAdmin } from '../_lib/firebase-admin-helper.js';

// 1. UPDATED: Document path in Firestore
const DOC_PATH = 'siteContent/terms_and_conditions'; 

export default async function handler(req, res) {
    const docRef = db.doc(DOC_PATH);

    if (req.method === 'GET') {
        try {
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                res.status(200).json(docSnap.data());
            } else {
                // 2. UPDATED: Default content to match your JSON
                res.status(200).json({ 
                    pageTitle: "Terms and Conditions",
                    sections: [
                        {
                            "title": "1. Introduction",
                            "content": "Welcomes to LuxuryHampers (or \"House Project\"). These terms and conditions outline the rules and regulations for the use of Our Website, located at [YourWebsiteURL.com - if applicable]. By accessing this website we assume you accept these terms and conditions. Do not continue to use LuxuryHampers if you do not agree to take all of the terms and conditions stated on this page."
                        },
                        {
                            "title": "2. Intellectual Property Rights",
                            "content": "Unless otherwise stated, LuxuryHampers and/or its licensors own the intellectual property rights for all material on LuxuryHampers. All intellectual property rights are reserved. You may access this from LuxuryHampers for your own personal use subjected to restrictions set in these terms and conditions.\n\nYou must not:\n\n• Republish material from LuxuryHampers\n• Sell, rent or sub-license material from LuxuryHampers\n• Reproduce, duplicate or copy material from LuxuryHampers\n• Redistribute content from LuxuryHampers"
                        },
                        {
                            "title": "3. Products and Orders",
                            "content": "All products are subject to availability. We reserve the right to limit the quantities of any products or services that we offer. All descriptions of products or product pricing are subject to change at any time without notice, at our sole discretion. We reserve the right to discontinue any product at any time.\n\nWe have made every effort to display as accurately as possible the colors and images of our products that appear at the store. We cannot guarantee that your computer monitor's display of any color will be accurate."
                        },
                        {
                            "title": "4. Payment",
                            "content": "Payment must be made in full at the time of ordering. We accept various payment methods as indicated on our website. All payments are processed securely."
                        },
                        {
                            "title": "5. Delivery",
                            "content": "Delivery times are estimates only and commence from the date of shipping, rather than the date of order. For more details, please see our Delivery Information page."
                        },
                        {
                            "title": "6. Returns and Refunds",
                            "content": "Please refer to our Returns Policy page for detailed information on returns and refunds. Due to the nature of perishable goods, some items may not be eligible for return."
                        },
                        {
                            "title": "7. Limitation of Liability",
                            "content": "To the fullest extent permitted by applicable law, LuxuryHampers shall not be liable for any indirect, incidental, special, consequential or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from (a) your access to or use of or inability to access or use the service; (b) any conduct or content of any third party on the service."
                        },
                        {
                            "title": "8. Governing Law",
                            "content": "These Terms shall be governed and construed in accordance with the laws of the United Kingdom, without regard to its conflict of law provisions."
                        },
                        {
                            "title": "9. Changes to Terms",
                            "content": "We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion."
                        },
                        {
                            "title": "10. Contact Us",
                            "content": "If you have any questions about these Terms, please contact us."
                        }
                    ]
                });
            }
        } catch (error) {
            console.error("[API GET /admin/terms_and_conditions] Error:", error);
            res.status(500).json({ error: 'Failed to fetch content.' });
        }
    } else if (req.method === 'POST') {
        if (!(await verifyAdmin(req))) {
            return res.status(403).json({ error: 'Forbidden: Admin access required.' });
        }
        
        try {
            const { pageTitle, sections } = req.body;
            if (!pageTitle || !Array.isArray(sections)) {
                return res.status(400).json({ error: 'Invalid data. "pageTitle" and "sections" array are required.' });
            }
            await docRef.set({ pageTitle, sections }, { merge: true });
            res.status(200).json({ success: true, message: 'Content updated successfully.' });
        } catch (error) {
            console.error("[API POST /admin/terms_and_conditions] Error:", error);
            res.status(500).json({ error: 'Failed to save content.' });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
}
