import { APIGatewayEvent } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  EventBridgeClient,
  PutEventsCommand
} from "@aws-sdk/client-eventbridge";
import { createPerson } from "./index";

const dynamoDBClientMock = mockClient(DynamoDBDocumentClient);
const eventBridgeClientMock = mockClient(EventBridgeClient);

const validPersonBody = {
  firstName: "Mickey",
  lastName: "Mouse",
  phone: "+33969326066",
  address: "Disneyland"
};

const makeEvent = (body: unknown): APIGatewayEvent =>
  ({ body: JSON.stringify(body) }) as APIGatewayEvent;

beforeAll(() => {
  process.env["PERSONS_TABLE_NAME"] = "persons-table";
  process.env["PERSONS_EVENT_BUS_NAME"] = "persons-bus";
});

beforeEach(() => {
  dynamoDBClientMock.reset();
  eventBridgeClientMock.reset();
  dynamoDBClientMock.on(PutCommand).resolves({});
  eventBridgeClientMock.on(PutEventsCommand).resolves({});
});

describe("createPerson", () => {
  describe("happy paths", () => {
    it("returns 200 with the person id when things are as expected", async () => {
      const response = await createPerson(makeEvent(validPersonBody));

      expect(response.statusCode).toBe(200);
      expect(response.headers?.["Content-Type"]).toBe("application/json");
      const body = JSON.parse(response.body);
      expect(body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it("stores the person in DynamoDB with a new id", async () => {
      await createPerson(makeEvent(validPersonBody));

      const putCall = dynamoDBClientMock.commandCalls(PutCommand)[0];
      expect(putCall!.args[0].input.TableName).toBe("persons-table");
      expect(putCall!.args[0].input.Item).toMatchObject(validPersonBody);
      expect(putCall!.args[0].input.Item!["id"]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it("sends a person-created-event to EventBridge with the person id", async () => {
      await createPerson(makeEvent(validPersonBody));

      const putEventsCall =
        eventBridgeClientMock.commandCalls(PutEventsCommand)[0];
      const entry = putEventsCall!.args[0].input.Entries?.[0];
      expect(entry?.Source).toBe("persons-service");
      expect(entry?.DetailType).toBe("person-created-event");
      expect(entry?.EventBusName).toBe("persons-bus");
      const detail = JSON.parse(entry?.Detail ?? "{}");
      expect(detail.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  describe("unhappy paths", () => {
    beforeEach(() => {
      process.env["PERSONS_TABLE_NAME"] = "persons-table";
      process.env["PERSONS_EVENT_BUS_NAME"] = "persons-bus";
    });

    afterEach(() => {
      delete process.env["PERSONS_TABLE_NAME"];
      delete process.env["PERSONS_EVENT_BUS_NAME"];
    });

    it("returns 400 when required fields are missing", async () => {
      const response = await createPerson(makeEvent({ firstName: "John" }));

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it("returns 400 when the request body is undefined", async () => {
      expect(
        (await createPerson({ body: undefined } as unknown as APIGatewayEvent))
          .statusCode
      ).toBe(400);

      expect(eventBridgeClientMock.commandCalls(PutEventsCommand)).toHaveLength(
        0
      );

      expect(dynamoDBClientMock.commandCalls(PutCommand)).toHaveLength(0);
    });

    it("returns 400 when a field has the wrong type", async () => {
      const response = await createPerson(
        makeEvent({ ...validPersonBody, phone: 12345 })
      );

      expect(response.statusCode).toBe(400);
    });

    it("errors-out when PERSONS_TABLE_NAME or PERSONS_EVENT_BUS_NAME are not set", async () => {
      delete process.env["PERSONS_TABLE_NAME"];

      await expect(createPerson(makeEvent(validPersonBody))).rejects.toThrow(
        "PERSONS_TABLE_NAME environment variable is not set"
      );

      process.env["PERSONS_TABLE_NAME"] = "persons-table";
      delete process.env["PERSONS_EVENT_BUS_NAME"];

      await expect(createPerson(makeEvent(validPersonBody))).rejects.toThrow(
        "PERSONS_EVENT_BUS_NAME environment variable is not set"
      );
    });

    it("propagates errors thrown by DynamoDB", async () => {
      dynamoDBClientMock.on(PutCommand).rejects(new Error("oops"));

      await expect(createPerson(makeEvent(validPersonBody))).rejects.toThrow(
        "oops"
      );
    });

    it("propagates errors thrown by EventBridge", async () => {
      eventBridgeClientMock.on(PutEventsCommand).rejects(new Error("oh no"));

      await expect(createPerson(makeEvent(validPersonBody))).rejects.toThrow(
        "oh no"
      );
    });
  });
});
