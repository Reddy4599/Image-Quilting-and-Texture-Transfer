document.getElementById("registerForm").addEventListener("submit", async function(event) {
    event.preventDefault(); // Prevent form from submitting normally

    // Get form values safely
    const usernameField = document.getElementById("username");
    const passwordField = document.getElementById("password");

    if (!usernameField || !passwordField) {
        console.error("❌ Form fields are missing!");
        return;
    }

    const username = usernameField.value.trim();
    const password = passwordField.value.trim();

    if (!username || !password) {
        alert("⚠️ All fields are required!");
        return;
    }

    let formData = { username, password };

    try {
        let response = await fetch("http://localhost:5001/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        });

        let data = await response.json();
        if (data.success) {
            alert("✅ Registration successful!");
            window.location.href = "index.html"; // Redirect to login page
        } else {
            alert("❌ Error: " + data.message);
        }
    } catch (error) {
        console.error("❌ Request failed:", error);
        alert("Server error. Try again later!");
    }
});
