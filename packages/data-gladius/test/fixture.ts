// SPDX-FileCopyrightText: 2026 Alex Bruecken Blaum
// SPDX-License-Identifier: MIT
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fixtureSchema, type Fixture } from "@speedwall-lab/data-gladius/fixture-schema";
import { profileFromFixture } from "@speedwall-lab/data-gladius";

const path = fileURLToPath(new URL("../../../research/gladius-v1-fixture.json", import.meta.url));

export const rawFixture: unknown = JSON.parse(readFileSync(path, "utf8"));
export const fixture: Fixture = fixtureSchema.parse(rawFixture);
export const profile = profileFromFixture(fixture);
