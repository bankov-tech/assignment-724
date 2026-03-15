# V's solution to assignment 724

## Description

A microservice, built with CDK, that implements the Person Service.

## Architecture

The base architecture is as follows:

- The app is composed of three different stacks:
  - Persons-Database: The DynamoDB table that stores the person data
  - Persons-EventBus: The EventBridge bus that handles the events related to the person service
  - Persons-API: The API Gateway and the λ function that handles the API requests

The principal of least privilege is enforced, so the λ function has the minimum permissions required to perform its
operations.

## How to deploy

There is a bunch of npm scripts that can help you build, test & deploy this app to your account. The most notable ones
are:

- `npm run clean-deploy` - catch-all command: cleanup, rebuild & deploy the CDK app
- `npm run build` - transpile the TypeScript code
- `npm run pre-deploy` - prepare everything for deployment, including building and synthesizing the CDK app
- `npm run deploy` - deploy the CDK app to your AWS account
- `npm run destroy` - delete the deployed CDK app
- `npm run test` - run the unit tests
- `npm run test:coverage` - runs the unit tests & generate a coverage report
- `npm run lint` - lint the codebase with Prettier

To deploy the app from a fresh git clone, you can run the following commands:

```bash
npm install
npm run clean-deploy
```

This will deploy the app using a `dev` stage.

You can leverage the `STAGE` environment variable to deploy a parallel stack with a different stage name, for example:

```bash
STAGE=acc npm run clean-deploy
```

## How to use

Once the app is deployed, you can use the API Gateway endpoint to create a person in the landscape.

The API stage is versioned, currently at `/v1`, so the endpoint is `POST https://$API_BASE_URL/v1/person`.
You can find the API base URL in the logs of the CDK command or in the CloudFormation outputs of the `Persons-API`
stack.

The data schema of the API contract is the following (all fields are required strings):

```json
{
  "firstName": "Mickey",
  "lastName": "Mouse",
  "phone": "+33969326066",
  "address": "Disneyland"
}
```

## Things to note

- You might need to run `npx cdk bootstrap` before deploying the app for the first time
- The EventBridge bus currently logs all messages to the CloudWatch log group `/aws/events/persons-$STAGE` for demo
  purposes

## Points for improvement

- The API Gateway endpoint is currently **not** protected, so anyone can create a person.
- The EventBridge <> CloudWatch logging mechanism causes a λ log group (`/aws/lambda/EventBus-$STAGE-$HASH`) to be
  retained after deleting the stacks because it is created as part of an internal λ handler implementation. You will
  need to delete this manually since I did not
  have enough time to sort it out, apologies for the inconvenience
- There are no CI/CD pipelines
- There are no OpenAPI specs generated for the API
- CDK complains about its own internal API usage. That seems to be internal tech debt of the `TableV2` implementation
  that we can't do much about at the moment
- The unit tests are covering 100% of the λ code, but we could add integration tests that test the
  whole flow
- There are no list & get endpoints for the person service, but that was not required by the assignment description
- The app currently uses npm as the package manager, which is fine for a small project, but for a larger project I would
  consider using yarn or pnpm for better performance
