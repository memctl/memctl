import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true });

/**
 * Validate memory content against a JSON schema defined on the context type.
 * If schema is null/empty, validation always passes.
 */
export function validateContent(
  schema: string | null,
  content: string,
): { valid: boolean; errors?: string[] } {
  if (!schema) return { valid: true };

  try {
    const schemaObj = JSON.parse(schema);
    const validate = ajv.compile(schemaObj);

    let contentObj: unknown;
    try {
      contentObj = JSON.parse(content);
    } catch {
      return {
        valid: false,
        errors: [
          "Content is not valid JSON but schema validation requires JSON content",
        ],
      };
    }

    const valid = validate(contentObj);
    if (valid) return { valid: true };

    const errors = (validate.errors ?? []).map(
      (e) => `${e.instancePath || "/"}: ${e.message}`,
    );
    return { valid: false, errors };
  } catch (err) {
    return {
      valid: false,
      errors: [
        `Schema parsing failed: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }
}
