export const errorHandler = (error, req, res, next) => {
  const status = error.statusCode || 500;
  const message = error.expose ? error.message : "Internal server error.";

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({ message });
};
