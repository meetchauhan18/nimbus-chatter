
export const successResponse = (
  data,
  message = "Success",
  statusCode = 200
) => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString(),
});

export const errorResponse = (message, errors = null, statusCode = 500) => ({
  success: false,
  message,
  errors,
  statusCode,
  timestamp: new Date().toISOString(),
});

export const paginatedResponse = (data, pagination, message = "Success") => ({
  success: true,
  message,
  data,
  pagination: {
    page: pagination.page,
    limit: pagination.limit,
    total: pagination.total,
    pages: Math.ceil(pagination.total / pagination.limit),
    hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
    hasPrev: pagination.page > 1,
  },
  timestamp: new Date().toISOString(),
});
