export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function paginateRepository<T>(
  repository: {
    findAndCount: (options: any) => Promise<[T[], number]>;
  },
  options: {
    where?: any;
    relations?: string[];
    order?: any;
    page?: number;
    limit?: number;
  },
): Promise<PaginationResult<T>> {
  const page = options.page && options.page > 0 ? options.page : 1;
  const limit = options.limit && options.limit > 0 ? options.limit : 10;
  const skip = (page - 1) * limit;

  const [data, total] = await repository.findAndCount({
    where: options.where || {},
    relations: options.relations || [],
    order: options.order || {},
    skip,
    take: limit,
  });

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages,
  };
}
