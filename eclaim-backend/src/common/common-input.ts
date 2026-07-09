// src/common/dto/query.dto.ts

export class FindManyInput<T> {
  where?: Partial<T>; // e.g., { name: 'John' }
  skip?: number; // offset
  take?: number; // limit
  orderBy?: Record<keyof T, 'ASC' | 'DESC'>; // e.g., { createdAt: 'DESC' }
  select?: (keyof T)[]; // optional selected fields
}

export class FindOneInput<T> {
  where: Partial<T>; // e.g., { id: '123' }
}
