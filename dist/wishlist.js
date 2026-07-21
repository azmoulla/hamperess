// FILE: wishlist.js

const wishlist = (() => {
    const WISHLIST_KEY = 'wishlistItems'; // Same key as in your Flutter app

    // Load wishlist IDs from localStorage
    function getItems() {
        const itemsJson = localStorage.getItem(WISHLIST_KEY);
        return itemsJson ? JSON.parse(itemsJson) : [];
    }

    // Save wishlist IDs to localStorage
    function saveItems(items) {
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
        // Notify the app that the wishlist has changed
        window.dispatchEvent(new Event('wishlistChange'));
    }

    return {
        // Method to check if a product is in the wishlist
        isWishlisted(productId) {
            return getItems().includes(String(productId));
        },

        // Method to add/remove a product from the wishlist
        toggleWishlist(productId) {
            let items = getItems();
            const idString = String(productId);
            if (items.includes(idString)) {
                items = items.filter(id => id !== idString);
            } else {
                items.push(idString);
            }
            saveItems(items);
        },
        
        // Method to get all item IDs
        getAllItemIds() {
            return getItems();
        }
    };
})();
