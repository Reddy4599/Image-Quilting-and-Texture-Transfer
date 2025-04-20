document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");

    if (!loginForm) {
        console.error("❌ Error: Login form not found!");
        return;
    }

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const usernameInput = document.getElementById("username");
        const passwordInput = document.getElementById("password");

        if (!usernameInput || !passwordInput) {
            console.error("❌ Error: Username or Password input not found!");
            return;
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            alert("⚠️ Please enter both username and password!");
            return;
        }

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem("token", data.token);
                alert("✅ Login successful!");
                window.location.href = "/dashboard.html"; // Redirect after login
            } else {
                alert("❌ Login failed: " + data.message);
            }
        } catch (error) {
            console.error("❌ Error: ", error);
            alert("⚠️ Network or server error occurred!");
        }
    });
});
