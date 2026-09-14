function notFound(req, res) {
  res.status(404).json({ message: 'Route not found' });
}

function errorHandler(error, req, res, next) {
  console.error(error);
  const status = error.statusCode || (error.name === 'ZodError' || error.name === 'ValidationError' ? 400 : 500);
  const code = error.code || (error.name === 'ZodError' ? 'INVALID_REQUEST' : status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');
  const message = status === 500 ? 'Internal server error' : error.message;
  res.status(status).json({
    success: false,
    error: { code, message },
    message
  });
}

module.exports = { notFound, errorHandler };
