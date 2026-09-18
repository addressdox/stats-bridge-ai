import { createFileRoute } from "@tanstack/react-router";

import { jsonResponse, preflight } from "./_shared";

const document = {
  openapi: "3.1.0",
  info: {
    title: "Naledi public API",
    version: "1.0.0",
    description:
      "One checked answer record for official South African statistics. Evidence is built on the server; the AI wording is kept in a separate field.",
  },
  servers: [{ url: "/api/public/v1" }],
  paths: {
    "/ask": {
      post: {
        summary: "Ask a question",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["question"],
                properties: {
                  question: { type: "string", minLength: 3, maxLength: 800 },
                  readingLevel: { type: "string", enum: ["short", "standard", "detailed"] },
                  language: { type: "string" },
                  siteKey: { type: ["string", "null"] },
                  parentAnswerRef: { type: ["string", "null"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "A referenced answer, a clarifying question, an honest gap, or an escalation." },
          "400": { description: "Validation failed." },
          "429": { description: "Rate limited." },
        },
      },
    },
    "/escalate": {
      post: {
        summary: "Send a question to a communications official",
        responses: { "200": { description: "Acknowledgement with a case reference and a private status token." } },
      },
    },
    "/media-query": {
      post: {
        summary: "Log a media enquiry",
        description: "Always an acknowledgement only. No substantive wording is ever returned for media requests.",
        responses: { "200": { description: "Acknowledgement with a case reference and a private status token." } },
      },
    },
    "/case-status": {
      post: {
        summary: "Read a private case status",
        responses: {
          "200": { description: "The case status." },
          "404": { description: "Returned for both a wrong token and a case that does not exist." },
        },
      },
    },
  },
} as const;

export const Route = createFileRoute("/api/public/v1/openapi")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: () => jsonResponse(document),
    },
  },
});
