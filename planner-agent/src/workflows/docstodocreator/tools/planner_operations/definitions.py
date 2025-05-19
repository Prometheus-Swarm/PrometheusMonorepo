from .implementations import (
    generate_sections,
    generate_system_prompt,
    validate_sections,
)

DEFINITIONS = {
    "generate_sections": {
        "name": "generate_sections",
        "description": "Generate a JSON file containing tasks from a feature breakdown.",
        "parameters": {
            "type": "object",
            "properties": {
                "sections": {
                    "type": "array",
                    "description": "List of sections",
                },
            },
            "required": ["sections"],
            "additionalProperties": False,
        },
        "final_tool": True,
        "function": generate_sections,
    },
    "validate_sections": {
        "name": "validate_sections",
        "description": "Validate the sections for the repository.",
        "parameters": {
            "type": "object",
            "properties": {
                "result": {
                    "type": "boolean",
                    "description": "Result of the validation",
                },
            },
            "required": ["result"],
            "additionalProperties": False,
        },
        "final_tool": True,
        "function": validate_sections,
    },
        "generate_system_prompt": {
        "name": "generate_system_prompt",
        "description": "Generate a system prompt for implementing the feature.",
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "The system prompt text that will guide the implementation",
                    "minLength": 10,
                },
            },
            "required": ["prompt"],
            "additionalProperties": False,
        },
        "final_tool": True,
        "function": generate_system_prompt,
    },
}