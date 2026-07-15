import Joi from "joi";

import { HttpError } from "../error/response-error.js";

const variantAttributeRule = Joi.object({
  type: Joi.string().valid("string", "number", "boolean").required(),
  required: Joi.boolean().default(false),
  values: Joi.when("type", {
    is: "string",
    then: Joi.array().items(Joi.string()).min(1),
    otherwise: Joi.forbidden()
  }),
  min: Joi.when("type", {
    is: "number",
    then: Joi.number(),
    otherwise: Joi.forbidden()
  }),
  max: Joi.when("type", {
    is: "number",
    then: Joi.number(),
    otherwise: Joi.forbidden()
  })
}).custom((rule, helpers) => {
  const invalidRange =
    rule.type === "number" &&
    rule.min !== undefined &&
    rule.max !== undefined &&
    rule.min > rule.max;

  return invalidRange ? helpers.error("any.invalid") : rule;
});

export const variantSchemaInput = Joi.object()
  .pattern(Joi.string().min(1).max(80), variantAttributeRule)
  .min(1)
  .required();

function attributeValidator(rule) {
  if (rule.type === "boolean") return Joi.boolean();

  if (rule.type === "string") {
    return rule.values ? Joi.string().valid(...rule.values) : Joi.string();
  }

  let validator = Joi.number();
  if (rule.min !== undefined) validator = validator.min(rule.min);
  if (rule.max !== undefined) validator = validator.max(rule.max);
  return validator;
}

export function validateVariantAttributes(variantSchema, attributes) {
  const fields = Object.fromEntries(
    Object.entries(variantSchema).map(([name, rule]) => {
      const validator = attributeValidator(rule);
      return [name, rule.required ? validator.required() : validator.optional()];
    })
  );

  const result = Joi.object(fields).unknown(false).validate(attributes, {
    abortEarly: false,
    convert: false
  });

  if (result.error) {
    throw new HttpError(
      400,
      "Variant attributes do not match product schema",
      result.error.details.map((detail) => detail.message)
    );
  }

  return result.value;
}

