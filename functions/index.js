const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.onNewUser = functions.auth.user().onCreate(async (user) => {
    const userId = user.uid;
    const userEmail = user.email;
    const userRef = admin.firestore().collection("users").doc(userEmail);

    await userRef.set({
        id: userId,
        emailAddress: user.email,
        associatedBudgetIds: [],
    }, { merge: true },);
});


// This method is used so to add newly created budget to the user's associatedBudgetIds array
exports.onNewBudget = functions.firestore
    .document('budgets/{budgetId}')
    .onCreate(async (snap, context) => {
        const budgetId = context.params.budgetId;
        const budgetData = snap.data();
        const createdUserEmail = budgetData.createdByUserEmail;

        const userRef = admin.firestore().collection("users").doc(createdUserEmail);

        // Add the new budgetId to the user's associatedBudgetIds array
        await userRef.update({
            associatedBudgetIds: admin.firestore.FieldValue.arrayUnion(budgetId)
        });
    });

exports.onSharedWithUserIdsUpdated = functions.firestore
    .document('budgets/{budgetId}')
    .onUpdate(async (change, context) => {
        const newValue = change.after.data();
        const previousValue = change.before.data();

        console.log("ADD NEW BUDGET");

        const beforeAssociatedBudgetIds = previousValue.sharedWithUserIds || [];
        const afterAssociatedBudgetIds = newValue.sharedWithUserIds || [];

        console.log("BEFORE ITES", beforeAssociatedBudgetIds);
        console.log("AFTER ITES", afterAssociatedBudgetIds);


        // Find emails (user IDs) added or removed
        const addedEmails = afterAssociatedBudgetIds.filter(email => !beforeAssociatedBudgetIds.includes(email));
        const removedEmails = beforeAssociatedBudgetIds.filter(email => !afterAssociatedBudgetIds.includes(email));

        console.log("ADD EMAILS", addedEmails);

        for (const email of addedEmails) {
            console.log(`Added email ${email} to associatedBudgetIds`);

            try {
                // Update user's document in the 'users' collection by adding the budgetId to their associatedBudgets array
                await admin.firestore().collection('users').doc(email).update({
                    associatedBudgetIds: admin.firestore.FieldValue.arrayUnion(context.params.budgetId)
                });
                console.log(`Added budgetId ${context.params.budgetId} to user ${email}`);
            } catch (error) {
                console.error(`Error adding budgetId ${context.params.budgetId} to user ${email}: `, error);
            }
        }

        for (const email of removedEmails) {
            try {
                // Update user's document in the 'users' collection by removing the budgetId from their associatedBudgets array
                await admin.firestore().collection('users').doc(email).update({
                    associatedBudgetIds: admin.firestore.FieldValue.arrayRemove(context.params.budgetId)
                });
                console.log(`Successfully removed budgetId ${context.params.budgetId} from user ${email}`);
            } catch (error) {
                console.error(`Error removing budgetId ${context.params.budgetId} from user ${email}: `, error);
            }
        }
    })

exports.onBudgetDelete = functions.firestore
    .document('budgets/{budgetId}')
    .onDelete(async (snapshot, context) => {
        const deletedBudgetId = context.params.budgetId;
        const budgetData = snapshot.data();

        const sharedWithUserIds = budgetData.sharedWithUserIds;
        const createdByUserEmail = budgetData.createdByUserEmail;

        const firestore = admin.firestore();
        const batch = firestore.batch();

        const userRefCreator = firestore.collection('users').doc(createdByUserEmail);

        batch.update(userRefCreator, {
            associatedBudgetIds: admin.firestore.FieldValue.arrayRemove(deletedBudgetId)
        });

        if (!sharedWithUserIds || sharedWithUserIds.length === 0) {
            console.log('No users to update for this deleted budget.');
            return null;
        }

        // Iterate over each user ID and remove the deleted budget from their associatedBudgetIds
        for (const userId of sharedWithUserIds) {
            const userRef = firestore.collection('users').doc(userId);

            // Update the user's associatedBudgetIds array by removing the deleted budget ID
            batch.update(userRef, {
                associatedBudgetIds: admin.firestore.FieldValue.arrayRemove(deletedBudgetId)
            });
        }

        // Commit the batch operation
        await batch.commit();

        console.log(`Deleted budget ${deletedBudgetId} removed from associatedBudgetIds of users: ${sharedWithUserIds.join(', ')}`);

        return null;
    });