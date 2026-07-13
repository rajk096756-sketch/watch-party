/**
 * Leak-Proof Global Error Handler Middleware
 * Intercepts all runtime errors, logs the full trace securely to the server console,
 * and shields the user from schema paths, raw SQL details, and engine dumps.
 */
export const errorHandler = (err, req, res, next) => {
  const timestamp = new Date().toISOString();
  
  // Log granular diagnostic information securely on the server
  console.error(`[SERVER ERROR] [${timestamp}]`);
  console.error(`Route: ${req.method} ${req.originalUrl}`);
  console.error(`IP: ${req.ip}`);
  console.error(`Message: ${err.message}`);
  console.error(`Stack Trace:`, err.stack);

  // Set appropriate status code (default to 500)
  const statusCode = err.status || err.statusCode || 500;

  // Formulate a clean, generic, secure response
  const userMessage = statusCode === 500 
    ? 'A secure server event has occurred. Our engineers are investigating.' 
    : err.message;

  return res.status(statusCode).json({
    success: false,
    message: userMessage
  });
};
