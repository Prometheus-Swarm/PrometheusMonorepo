from .implementations import (
    generate_tasks,
    validate_tasks,
    regenerate_tasks,
    create_task_dependency,
    generate_issues,
    audit_tasks,
    generate_system_prompt,
    approve_issues,
)

DEFINITIONS = {
    "generate_tasks": {
        "name": "generate_tasks",
        "description": "Generate a JSON file containing tasks from a feature breakdown.",
        "parameters": {
            "type": "object",
            "properties": {
                "tasks": {
                    "type": "array",
                    "description": "List of tasks",
                    "items": {
                        "type": "object",
                        "properties": {
                             "info": {
                                "type": "object",
                                "description": "Metadata of the task",
                                "properties": {
                                    "Todo": {
                                        "type": "string",
                                        "description": "What needs to be done",
                                    },
                                    "Description": {
                                        "type": "string",
                                        "description": "Detailed explanation of the work required",
                                    },
                                },
                            },
                            "tools": {
                                "type": "array",
                                "description": "Tools we need to use to complete the task",
                                "items": {"type": "string", "minLength": 1},
                            },
                            "acceptance_criteria": {
                                "type": "array",
                                "description": "List of verifiable acceptance criteria",
                                "items": {"type": "string", "minLength": 1},
                            },
                        },
                        "required": ["info", "tools", "acceptance_criteria"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["tasks"],
            "additionalProperties": False,
        },
        "final_tool": True,
        "function": generate_tasks,
    },
    "docs_generate_tasks": {
        "name": "docs_generate_tasks",
        "description": "Generate a JSON file containing tasks from a feature breakdown.",
        "parameters": {
            "type": "object",
            "properties": {
                "tasks": {
                    "type": "array",
                    "description": "List of tasks",
                    "items": {
                        "type": "object",
                        "properties": {
                            "info": {
                                "type": "object",
                                "description": "Metadata of the task",
                                "properties": {
                                    "Type": {
                                        "type": "string",
                                        "description": "Type of the file (e.g., 'Folder'/'File')",
                                    },
                                    "Path": {
                                        "type": "string",
                                        "description": "Path to the file",
                                    },
                                    "ReadmeFileName": {
                                        "type": "string",
                                        "description": "Name of the readme file",
                                    },
                                    "SectionName": {
                                        "type": "string",
                                        "description": "Name of the section",
                                    },
                                },
                            },
                            "tools": {
                                "type": "array",
                                "description": "Tools we need to use to complete the task",
                                "items": {"type": "string", "minLength": 1},
                            },
                            "acceptance_criteria": {
                                "type": "array",
                                "description": "List of verifiable acceptance criteria",
                                "items": {"type": "string", "minLength": 1},
                                "minItems": 1,
                            },
                        },
                        "required": ["info", "tools", "acceptance_criteria"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["tasks"],
            "additionalProperties": False,
        },
        "final_tool": True,
        "function": generate_tasks,
    },
    
    "regenerate_tasks": {
        "name": "regenerate_tasks",
        "description": "Regenerate the tasks.",
        "parameters": {
            "type": "object",
            "properties": {
                "tasks": {
                    "type": "array",
                    "description": "List of tasks",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "Clear, specific title of the task",
                                "maxLength": 100,
                            },
                            "description": {
                                "type": "string",
                                "description": "Detailed explanation of the work required",
                                "minLength": 10,
                            },
                            "acceptance_criteria": {
                                "type": "array",
                                "description": "List of verifiable acceptance criteria",
                                "items": {"type": "string", "minLength": 1},
                                "minItems": 1,
                            },
                            "uuid": {
                                "type": "string",
                                "description": "UUID of the task",
                            },
                        },
                        "required": [
                            "title",
                            "description",
                            "acceptance_criteria",
                            "uuid",
                        ],
                        "additionalProperties": False,
                    },
                },
                # "file_name": {
                #     "type": "string",
                #     "description": "Name of the output JSON file",
                #     "default": "tasks.json",
                # },
                # "repo_url": {
                #     "type": "string",
                #     "description": "URL of the repository (for reference)",
                # },
            },
            "required": ["tasks"],
            "additionalProperties": False,
        },
        "final_tool": True,
        "function": regenerate_tasks,
    },

    "create_task_dependency": {
        "name": "create_task_dependency",
        "description": "Create the task dependency for a task.",
        "parameters": {
            "type": "object",
            "properties": {
                "task_uuid": {
                    "type": "string",
                    "description": "UUID of the task",
                },
                "dependency_tasks": {
                    "type": "array",
                    "description": "List of UUIDs of dependency tasks",
                },
            },
            "required": ["task_uuid", "dependency_tasks"],
            "additionalProperties": False,
        },
        "final_tool": True,
        "function": create_task_dependency,
    },
    "generate_issues": {
        "name": "generate_issues",
        "description": "Generate a JSON file containing issues from a feature breakdown.",
        "parameters": {
            "type": "object",
            "properties": {
                "issues": {
                    "type": "array",
                    "description": "List of issues",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "Clear, specific title of the issue",
                                "maxLength": 100,
                            },
                            "description": {
                                "type": "string",
                                "description": "Detailed explanation of the issue",
                                "minLength": 10,
                            },
                        },
                        "required": ["title", "description"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["issues"],
            "additionalProperties": False,
        },
        "final_tool": True,
        "function": generate_issues,
    },
    "approve_issues": {
        "name": "approve_issues",
        "description": "Approve the issues.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
        "final_tool": True,
        "function": approve_issues,
    },
    "audit_tasks": {
        "name": "audit_tasks",
        "description": "Audit the tasks.",
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
        "function": audit_tasks,
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
