export class CommonResponse<T> {
  statusCode: number;
  data: T;
  message: string;

  constructor(statusCode: number, data: T, message: string) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      data: this.data,
      message: this.message,
    };
  }
}

export class CommonErrorResponse {
  statusCode: number;
  error: string;
  message: string;

  constructor(statusCode: number, error: string, message: string) {
    this.statusCode = statusCode;
    this.error = error;
    this.message = message;
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      error: this.error,
      message: this.message,
    };
  }
}
