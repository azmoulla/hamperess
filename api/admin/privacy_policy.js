import { db, verifyAdmin } from '../_lib/firebase-admin-helper.js';

// 1. UPDATED: Document path in Firestore
const DOC_PATH = 'siteContent/privacy_policy'; 

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
                    pageTitle: "Privacy Policy",
                    sections: [
                        {
                            "title": "1. Introduction",
                            "content": "Your privacy is important to us. This privacy statement explains the personal data LuxuryHampers (or \"House Project\") processes, how LuxuryHampers processes it, and for what purposes. We are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about this privacy notice, or our practices with regards to your personal information, please contact us."
                        },
                        {
                            "title": "2. Information We Collect",
                            "content": "We collect personal information that you voluntarily provide to us when you register on the website, express an interest in obtaining information about us or our products and services, when you participate in activities on the website (such as posting messages in our online forums or entering competitions, contests or giveaways) or otherwise when you contact us.\n\nThe personal information that we collect depends on the context of your interactions with us and the website, the choices you make and the products and features you use. The personal information we collect may include the following:\n\n• Personal Information Provided by You: Names; phone numbers; email addresses; mailing addresses; job titles; usernames; passwords; billing addresses; contact preferences; contact or authentication data; debit/credit card numbers; and other similar information.\n• Payment Data: We may collect data necessary to process your payment if you make purchases, such as your payment instrument number (such as a credit card number), and the security code associated with your payment instrument. All payment data is stored by our payment processor [Name of Payment Processor, e.g., Stripe, PayPal] and you should review its privacy policies and contact the payment processor directly to respond to your questions.\n• Information automatically collected: We automatically collect certain information when you visit, use or navigate the website. This information does not reveal your specific identity (like your name or contact information) but may include device and usage information, such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, information about how and when you use our website and other technical information. This information is primarily needed to maintain the security and operation of our website, and for our internal analytics and reporting purposes."
                        },
                        {
                            "title": "3. How We Use Your Information",
                            "content": "We use personal information collected via our website for a variety of business purposes described below. We process your personal information for these purposes in reliance on our legitimate business interests, in order to enter into or perform a contract with you, with your consent, and/or for compliance with our legal obligations.\n\n• To facilitate account creation and logon process.\n• To send administrative information to you.\n• Fulfill and manage your orders, payments, returns, and exchanges.\n• To request feedback and to contact you about your use of our website.\n• To send you marketing and promotional communications.\n• To protect our Services.\n• For other Business Purposes, such as data analysis, identifying usage trends, determining the effectiveness of our promotional campaigns and to evaluate and improve our website, products, marketing and your experience."
                        },
                        {
                            "title": "4. Will Your Information Be Shared With Anyone?",
                            "content": "We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations."
                        },
                        {
                            "title": "5. Cookies and Other Tracking Technologies",
                            "content": "We may use cookies and similar tracking technologies (like web beacons and pixels) to access or store information. Specific information about how we use such technologies and how you can refuse certain cookies is set out in our Cookie Policy [Link to Cookie Policy - if applicable, create a separate page or section]."
                        },
                        {
                            "title": "6. How Long Do We Keep Your Information?",
                            "content": "We will only keep your personal information for as long as it is necessary for the purposes set out in this privacy notice, unless a longer retention period is required or permitted by law (such as tax, accounting or other legal requirements)."
                        },
                        {
                            "title": "7. Your Privacy Rights",
                            "content": "Depending on your location, you may have certain rights regarding your personal information under applicable data protection laws. These may include the right to access, correct, update, or request deletion of your personal information. You may also have the right to object to processing of your personal information, ask us to restrict processing of your personal information or request portability of your personal information."
                        },
                        {
                            "title": "8. Changes To This Privacy Notice",
                            "content": "We may update this privacy notice from time to time. The updated version will be indicated by an updated \"Last Updated\" date and the updated version will be effective as soon as it is accessible. We encourage you to review this privacy notice frequently to be informed of how we are protecting your information."
                        },
                        {
                            "title": "9. How Can You Contact Us About This Notice?",
                            "content": "If you have questions or comments about this notice, you may email us at [Your Privacy Email Address, e.g., privacy@luxuryhampers.com] or by post to:\n\nLuxuryHampers Privacy Team\n[Your Company Address Line 1]\n[Your Company Address Line 2]\n[City, Postcode]\n[Country]"
                        }
                    ]
                });
            }
        } catch (error) {
            console.error("[API GET /admin/privacy_policy] Error:", error);
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
            console.error("[API POST /admin/privacy_policy] Error:", error);
            res.status(500).json({ error: 'Failed to save content.' });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
}