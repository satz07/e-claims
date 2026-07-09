## Setting up Project

Open PostgreSQL command line interface and run:

```
CREATE DATABASE nestjs;
```

("Replace 'nestjs' with your preferred database name, and make sure to use that same name in your .env file."). Tables will be auto generated.

## Description

NestJS authentication application that includes login and sign-up functionalities. Used a PostgreSQL database and connected it to NestJS. To manage a database easier, used an Object-relational mapping (ORM) tool called TypeORM.

## Installation

```bash
$ yarn install
```

## 🗄️ Database Migrations

This project uses **TypeORM** migrations to manage and synchronize database schema changes safely across different environments.

---

## 🚀 Commands for DB

```bash
# 1. Generate a new migration
yarn migration:generate

# 2. Run pending migrations
yarn migration:run
```

## Running the app

```bash
# development
$ yarn start

# watch mode
$ yarn start:dev

# production mode
$ yarn start:prod
```

## Test

```bash
# unit tests
$ yarn test

# e2e tests
$ yarn test:e2e

# test coverage
$ yarn test:cov
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## License

Nest is [MIT licensed](LICENSE).
