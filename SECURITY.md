# Security

LLM Wire Debug deliberately retains authentication headers, replayable cURL, user messages, prompts, tool definitions, and model responses without redaction. Enable it only for local debugging with data and credentials you are authorized to inspect. Never share a real capture, screenshot of credentials, or its storage directory in an issue, pull request, or public repository.

The bundled configuration requires an explicit `allowSecrets: true` override before capture can activate. Prompt translation is disabled in the bundle; enabling it submits the model-visible input to the original provider again and may incur charges. Capture storage uses restrictive POSIX permissions; Windows requires suitable account and filesystem access controls.

The HTTP and WebSocket viewer uses the host's connection authorization. Do not expose the debugging host on a public interface or disable its authentication. Anyone authorized to use this debugging host may be able to read all process-wide captures; captures are not isolated by the selected Session.

For reports, provide a minimal synthetic reproduction with fake credentials. Do not include real logs, `.env`, headers, cURL, prompts, private paths, or Session files. If a secret was published, revoke or rotate it first; adding `.gitignore` does not remove Git history.
