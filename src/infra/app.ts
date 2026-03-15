import { App } from "aws-cdk-lib";
import { DatabaseStack } from "./stacks/database.js";
import { ApiStack } from "./stacks/api.js";
import { EventBusStack } from "./stacks/eventbus";

const app = new App();

const stage: string = app.node.tryGetContext("stage") ?? "dev";

const dbStack = new DatabaseStack(app, `Persons-Database-${stage}`, { stage });
const eventBusStack = new EventBusStack(app, `Persons-EventBus-${stage}`, {
  stage
});
const apiStack = new ApiStack(app, `Persons-API-${stage}`, {
  stage,
  personsTable: dbStack.personsTable,
  eventBus: eventBusStack.eventBus
});

apiStack.addDependency(dbStack);
apiStack.addDependency(eventBusStack);

app.synth();
