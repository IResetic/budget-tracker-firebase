const {logger, functions } = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");

// The Firebase Admin SDK to access Firestore.
const { admin } = require("firebase-admin");
const {getFirestore} = require("firebase-admin/firestore");

admin.initializeApp();


exports.onNewUser = functions.auth.user().onCreate(async (user) => {
    const userId = user.uid;
    const userRef = admin.firestore().collection("users").doc(userId);

    await userRef.set({
        email: user.email,
        budget: {},
    }, { merge: true },);
});
