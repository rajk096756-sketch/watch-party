import { z } from 'zod';

/**
 * Strict Input Validation Middleware
 * Validates request payload (body, query, or params) against a Zod schema.
 * Discards extra attributes by substituting the target with Zod's parsed result.
 * 
 * @param {z.ZodSchema} schema - Zod validation schema
 * @param {'body' | 'query' | 'params'} source - request source to validate
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const target = req[source];
      // Zod's parse will strip out any keys not defined in the schema if it's an object with .strict() or default strip behaviour
      // We explicitly call .parse() and replace the field with the verified object.
      const parsed = schema.parse(target);
      
      req[source] = parsed;
      next();
    } catch (err) {
      // Return clear, non-leaking structure verification error
      return res.status(400).json({
        success: false,
        message: 'Input validation failed. Non-compliant payload structure or format.',
        details: err.errors ? err.errors.map(e => `${e.path.join('.')}: ${e.message}`) : err.message
      });
    }
  };
};
