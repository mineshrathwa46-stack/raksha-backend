function notFound(req, res) {
  res.status(404).json({ message: 'Route not found' });
}

function errorHandler(error, req, res, next) {
  console.error(error);
  const status = error.name === 'ValidationError' ? 400 : 500;
  res.status(status).json({ message: status === 500 ? 'Internal server error' : error.message });
}

module.exports = { notFound, errorHandler };
