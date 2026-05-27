import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createMockServices } from "./mocks.js";

describe("test routes", () => {
  it("returns a test session without correct answers", async () => {
    const app = await buildApp({ services: createMockServices() });

    const response = await app.inject({
      method: "GET",
      url: "/api/tests/test-1/session",
      headers: { authorization: "Bearer valid-student" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.questions).toHaveLength(2);
    expect(body.questions[0]).not.toHaveProperty("correctOption");
    expect(body.questions[0]).not.toHaveProperty("correct_option");
    await app.close();
  });

  it("grades submissions on the server and writes attempt details", async () => {
    const services = createMockServices();
    const app = await buildApp({ services });

    const response = await app.inject({
      method: "POST",
      url: "/api/tests/test-1/submit",
      headers: {
        authorization: "Bearer valid-student",
        "idempotency-key": "attempt-1",
      },
      payload: {
        answers: [
          { questionId: "q-1", selectedOption: "A" },
          { questionId: "q-2", selectedOption: "A" },
        ],
        durationSeconds: 120,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      attempt: {
        score: 3,
        maxScore: 8,
        correctCount: 1,
        wrongCount: 1,
      },
    });
    expect(services.test.createAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        score: 3,
        idempotencyKey: "attempt-1",
        answers: expect.arrayContaining([
          expect.objectContaining({ questionId: "q-1", isCorrect: true }),
          expect.objectContaining({ questionId: "q-2", isCorrect: false }),
        ]),
      }),
    );
    await app.close();
  });

  it("grades numerical answers without negative marks by default", async () => {
    const services = createMockServices({ includeNumericalQuestion: true });
    const app = await buildApp({ services });

    const response = await app.inject({
      method: "POST",
      url: "/api/tests/test-1/submit",
      headers: {
        authorization: "Bearer valid-student",
        "idempotency-key": "attempt-numerical",
      },
      payload: {
        answers: [
          { questionId: "q-1", answer: "A" },
          { questionId: "q-2", answer: "A" },
          { questionId: "q-3", answer: "5" },
          { questionId: "q-4", answer: "12" },
        ],
        durationSeconds: 180,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      attempt: {
        score: 7,
        maxScore: 16,
        correctCount: 2,
        wrongCount: 2,
      },
    });
    expect(services.test.createAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        score: 7,
        answers: expect.arrayContaining([
          expect.objectContaining({
            questionId: "q-3",
            questionType: "numerical",
            selectedAnswer: "5",
            correctAnswer: "5",
            isCorrect: true,
            marksAwarded: 4,
          }),
          expect.objectContaining({
            questionId: "q-4",
            questionType: "numerical",
            selectedAnswer: "12",
            correctAnswer: "10",
            isCorrect: false,
            marksAwarded: 0,
          }),
        ]),
      }),
    );
    await app.close();
  });

  it("enforces free test limits before writing an attempt", async () => {
    const services = createMockServices({ usedAttempts: 5, freeTestLimit: 5 });
    const app = await buildApp({ services });

    const response = await app.inject({
      method: "POST",
      url: "/api/tests/test-1/submit",
      headers: { authorization: "Bearer valid-student" },
      payload: {
        answers: [{ questionId: "q-1", selectedOption: "A" }],
        durationSeconds: 60,
      },
    });

    expect(response.statusCode).toBe(402);
    expect(response.json()).toMatchObject({ error: "FREE_LIMIT_REACHED" });
    expect(services.test.createAttempt).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns ranking groups with average rankings visible to all users", async () => {
    const services = createMockServices({ usedAttempts: 12 });
    const app = await buildApp({ services });

    const response = await app.inject({
      method: "GET",
      url: "/api/rankings/jee-main",
      headers: { authorization: "Bearer valid-student" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      publicRankings: {
        allIndiaRaw: expect.any(Array),
        stateRaw: expect.any(Array),
        cityRaw: expect.any(Array),
        allIndiaAverage: expect.any(Array),
      },
      organizationRankings: null,
      movement: {
        currentRank: 8941,
        previousRank: 12482,
        delta: 3541,
      },
    });
    await app.close();
  });
});
