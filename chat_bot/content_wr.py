# content_wr.py
import os
from typing import TypedDict
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

load_dotenv()

# -------------------------------
# LLM SETUP
# -------------------------------



api_key = os.getenv("GROQ_API_KEY")

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=api_key
)

parser = StrOutputParser()


# -------------------------------
# STATE DEFINITION
# -------------------------------
class State(TypedDict):
    topic: str
    post_caption: str
    review_content: str
    iteration: int


# -------------------------------
# NODE 1: CAPTION WRITER
# -------------------------------
def caption_writer(state: State):

    prompt_post = """
    You are a senior LinkedIn post writer. Write an engaging, professional LinkedIn caption for the topic: {topic}

    Incorporate previous review suggestions: {review_content}

    Guidelines: 100-200 words, hook + value + CTA, hashtags, emoji sparingly.
    """

    prompt = ChatPromptTemplate.from_messages([
        ("system", prompt_post)
    ])

    chain = prompt | llm | parser

    post_caption = chain.invoke({
        "topic": state["topic"],
        "review_content": state.get("review_content", "")
    })

    return {
        "post_caption": post_caption,
        "iteration": state.get("iteration", 0) + 1
    }


# -------------------------------
# NODE 2: REVIEWER
# -------------------------------
def caption_reviewer(state: State):

    review_prompt = """
    You are a senior LinkedIn caption reviewer. Review this caption: {post_caption}

    Check: Engaging hook? Professional tone? Value/insights? CTA? Length 100-200 words? Hashtags?

    Respond ONLY: "YES" if excellent, or "NO: [specific improvements]".
    """

    prompt = ChatPromptTemplate.from_messages([
        ("system", review_prompt)
    ])

    chain = prompt | llm | parser

    review_content = chain.invoke({
        "post_caption": state["post_caption"]
    })

    return {"review_content": review_content}


# -------------------------------
# CONDITIONAL LOGIC
# -------------------------------
def should_continue(state: State):

    iteration = state.get("iteration", 0)

    if iteration >= 3:
        return END

    if "yes" in state["review_content"].lower():
        return END

    return "caption_writer"


# -------------------------------
# GRAPH SETUP
# -------------------------------
checkpointer = MemorySaver()

graph = StateGraph(State)
graph.add_node("caption_writer", caption_writer)
graph.add_node("caption_reviewer", caption_reviewer)

graph.set_entry_point("caption_writer")

graph.add_edge("caption_writer", "caption_reviewer")

graph.add_conditional_edges(
    "caption_reviewer",
    should_continue,
    {
        "caption_writer": "caption_writer",
        END: END
    }
)

app_graph = graph.compile(checkpointer=checkpointer)


# -------------------------------
# MAIN FUNCTION (IMPORTANT)
# -------------------------------
def generate_caption(topic):
    """
    This is the function Flask will call
    """

    config = {"configurable": {"thread_id": "linkedin_post"}}

    result = app_graph.invoke({
        "topic": topic,
        "post_caption": "",
        "review_content": "",
        "iteration": 0
    }, config)

    return result["post_caption"]