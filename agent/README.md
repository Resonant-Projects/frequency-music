# Resonant Projects Agent

LangGraph/LangChain agent workspace for research synthesis tasks that need planning and tool use.

The first target is a weekly brief agent that reads from Convex through the read-only agent-tool surface documented in ../docs/agent-tool-surface.md.

## Local Setup

    cd agent
    cp .env.example .env
    npm install
    npm run dev

Required local env:

- ANTHROPIC_API_KEY
- CONVEX_SITE_URL
- AGENT_TOOL_SECRET
- LANGSMITH_API_KEY when tracing is enabled

The local LangGraph server defaults to port 2024.

## Deployment Notes

Convex remains the system of record. The agent server reads via /agent-tools/* and should be deployed as a separate service. Keith/Cool Guy own hosting; this directory contains deployment artifacts only.
