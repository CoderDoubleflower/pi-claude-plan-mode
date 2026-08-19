# Changelog

## 0.1.0

- Initial implementation of Claude Code-style Plan Mode for Pi.
- Planning uses Pi's structured `read`, `grep`, `find`, and `ls` tools.
- Adds canonical `plan_write`, `EnterPlanMode`, and `ExitPlanMode` tools.
- Adds `/plan` and `/plan-approve` commands.
- Supports keep-context execution and fresh child-session execution through stock Pi `/plan-approve`.
- Uses stock Pi `newSession({ setup, withSession })` for clear-context handoff; no Pi patch or hidden API detection.
- Terminates model-triggered `EnterPlanMode` turns and resumes planning with the read-only tool set.
- Restores Plan state across session-tree navigation and recovers interrupted execution handoffs.
- Supports separate planning and execution model/thinking profiles.
- Ignores project-local model configuration until the project is trusted.
- Rejects symbolic-link Plan files/directories and uses private atomic writes.
