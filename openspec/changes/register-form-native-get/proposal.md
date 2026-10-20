# Register form native GET fix

Set an explicit POST method on registration and login forms so a browser submission before React hydration cannot place credentials in the URL. Preserve the existing hydrated React Hook Form validation and server-action behavior. Verify both forms in a browser and run the repository's required test, lint, formatting, typecheck, and build gates.
