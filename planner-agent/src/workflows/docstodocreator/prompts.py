"""Prompts for the task decomposition workflow."""

PROMPTS = {
    "system_prompt": (
        "You are an expert software architect and technical lead specializing in breaking down complex "
        "features into small, manageable tasks. "
    ),
    "generate_sections": (
        "You identify and suggest appropriate sections that should be included in the project's README, "
        "Please use the repository's content and structure to generate the sections. "
        "such as installation instructions, usage examples, configuration details, and other relevant "
        "documentation sections that would help users understand and use the project effectively."
    ),
    "validate_sections": (
        "You need to verify if the given sections are valid and complete for this type of project."
        "The sections are: {sections}"
        "Please use the function to validate the sections with a boolean value."
    ),
    "generate_system_prompt": (
        "Your task is to create a comprehensive system prompt that will guide an AI agent in summarizing "
        "and analyzing documents effectively:\n\n"
        # "Document spec: {issue_spec}\n"
        # "Key points: {issues}\n"
        # "Analysis tasks: {tasks}\n\n"
        "Sections: {sections}\n\n"
        "Create a single system prompt that:\n"
        "1. Defines the AI's role and expertise needed for document analysis and summarization\n"
        "2. Provides comprehensive context about the document type and its key components\n"
        "3. Sets clear guidelines for information extraction and summarization\n"
        "4. Specifies document analysis standards and best practices\n"
        "5. Includes requirements for maintaining document context and accuracy\n"
        "6. Explains how different sections of the document relate to each other\n"
        "7. Provides guidance on maintaining consistency in summarization\n\n"
        "Format the system prompt as follows:\n"
        "---\n"
        "Document Overview:\n"
        "[High-level description of the document type and analysis goals]\n\n"
        "AI Role and Expertise:\n"
        "[Define the AI's role in document analysis and summarization]\n\n"
        "Analysis Context:\n"
        "[Comprehensive context about the document and its components]\n\n"
        "Analysis Guidelines:\n"
        "- [List document analysis requirements and guidelines]\n\n"
        "Summarization Standards:\n"
        "- [List summarization standards and best practices]\n\n"
        "Document Structure and Relationships:\n"
        "[Explain how different sections relate to each other]\n\n"
        "Quality and Accuracy Requirements:\n"
        "[Specify quality standards and accuracy requirements]\n"
        "---\n"
    ),
 }
