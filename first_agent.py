import os
import asyncio
from google.adk.agents import Agent
from google.adk.runners import InMemoryRunner
from google.adk.tools import google_search

runner = None  # global runner

def setUp():
    global runner
    try:
        # Prefer to set GOOGLE_API_KEY externally (shell, key manager).
        API_KEY = os.getenv("GOOGLE_API_KEY", None)
        if not API_KEY:
            # For quick testing only: set here (not recommended for real projects)
            API_KEY = ""
            os.environ["GOOGLE_API_KEY"] = API_KEY

        os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "FALSE"
        print("Gemini API key setup complete.")
    except Exception as e:
        print(f"Authentication setup error: {e}")

    root_agent = Agent(
        name="helpful_assistant",
        model="gemini-2.5-flash-lite",
        description="A simple agent that can answer general questions.",
        instruction="You are a helpful assistant. Use Google Search for current info or if unsure.",
        tools=[google_search],
    )
    print("Root Agent defined.")

    runner = InMemoryRunner(agent=root_agent)
    print("Runner created and assigned to global `runner`.")


async def ask():
    global runner
    if runner is None:
        print("Runner is not initialized. Did setUp() run correctly?")
        return

    try:
        # run_debug is async: await it
        response = await runner.run_debug(
            "What is Agent Development Kit from Google? What languages is the SDK available in?"
        )
        # Print something helpful from response. `.text` or `.content` depends on API.
        # print("Raw response object:", response)
        # If response is a string or has `.text`, show it:
        if isinstance(response, str):
            print(response)
        else:
            # attempt common attributes
            for attr in ("text", "content", "message", "output"):
                if hasattr(response, attr):
                    print(f"{attr}:", getattr(response, attr))
                    break
    except Exception as e:
        print("Error while running runner.run_debug():", repr(e))


def main():
    setUp()
    # Properly run the async function
    asyncio.run(ask())


if __name__ == "__main__":
    main()
