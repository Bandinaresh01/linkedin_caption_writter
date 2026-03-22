// Wait for DOM ready
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('captionForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await generatePost();
    });
});

// This function runs when button is clicked
async function generatePost() {

    try {
        // Step 1: Get user input
        var topic = document.getElementById("topic").value;

        // Step 2: Validation
        if (topic === "") {
            alert("Please enter a topic");
            return;
        }

        // Step 3: Show loading text
        document.getElementById("loading").style.display = "block";

        // Step 4: Call backend API
        var response = await fetch("/generate", {
            method: "POST",  // sending data
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ topic: topic })
        });

        // Step 5: Convert response to JSON
        var data = await response.json();

        // Step 6: Hide loading
        document.getElementById("loading").style.display = "none";

        // Step 7: Show result
        document.getElementById("output").innerText = data.result;

    } catch (error) {

        // Step 8: Error handling
        console.error(error);
        document.getElementById("loading").style.display = "none";
        alert("Something went wrong!");
    }
}