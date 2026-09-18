INSERT INTO public.guidelines (version_number, title, terminology, style_rules, number_rules, branding_rules, messaging_rules, status, approval_basis, activated_at)
VALUES (
  1,
  'StatBridge demonstration house style',
  '[
    {"use": "Statistics South Africa", "avoid": "StatsSA (without space)"},
    {"use": "the survey shows", "avoid": "the survey proves"},
    {"use": "unemployed persons", "avoid": "jobless people"}
  ]'::jsonb,
  'Plain language. One idea per sentence. Say what the figure is, who it covers and the period it belongs to. Never explain why a figure moved, never forecast, never take a policy position.',
  'Give percentages to one decimal place. Write millions as "63.1 million", never "63,100,000". Always attach the reference period to the figure.',
  'Neutral, factual, courteous. No slogans. Do not imply Statistics South Africa endorsement of this demonstration.',
  'If the evidence does not support the answer, say so and offer the human route. Never fill a gap with a guess.',
  'active',
  'demonstration',
  now()
);

WITH s AS (
  INSERT INTO public.sources (title, source_type, publisher, topic, canonical_url)
  VALUES ('Mid-year population estimates, 2025 (P0302)', 'statistical_release', 'Statistics South Africa', 'population', 'https://www.statssa.gov.za/publications/P0302/P03022025.pdf')
  RETURNING id
),
v AS (
  INSERT INTO public.source_versions (source_id, version_label, published_on, reference_period, original_url, ingest_state, status, approval_basis, approved_at)
  SELECT id, 'P0302 · 2025', '2025-07-28', 'Mid-2025', 'https://www.statssa.gov.za/publications/P0302/P03022025.pdf', 'done', 'approved', 'demonstration', now()
  FROM s RETURNING id, source_id
),
u AS (UPDATE public.sources SET current_version_id = (SELECT id FROM v) WHERE id = (SELECT source_id FROM v)),
p AS (
  INSERT INTO public.passages (source_version_id, position, page_number, section_label, content)
  SELECT v.id, t.position, t.page_number, t.section_label, t.content FROM v
  JOIN (VALUES
    (1, 1, 'Key findings', 'South Africa''s population is estimated at 63.1 million people at mid-2025, according to the Mid-year population estimates release (P0302).'),
    (2, 1, 'Provincial distribution', 'Gauteng remains the most populous province with about 16.1 million people, roughly 25.5% of the national total, at mid-2025.')
  ) AS t(position, page_number, section_label, content) ON true
  RETURNING id, position
)
INSERT INTO public.observations (source_version_id, passage_id, measure, measure_key, value, value_state, display_value, unit, population, geography, reference_period, page_number, verified_at)
SELECT v.id, (SELECT id FROM p WHERE position = o.position), o.measure, o.measure_key, o.value, 'reported', o.display_value, o.unit, o.population, o.geography, 'Mid-2025', 1, now()
FROM v
JOIN (VALUES
  (1, 'Total population', 'population_total', 63100000, '63.1 million', 'people', 'All residents', 'South Africa'),
  (2, 'Population of Gauteng', 'population_province', 16100000, '16.1 million', 'people', 'All residents', 'Gauteng'),
  (2, 'Gauteng share of national population', 'population_province_share', 25.5, '25.5%', 'percent', 'All residents', 'Gauteng')
) AS o(position, measure, measure_key, value, display_value, unit, population, geography) ON true;

WITH s AS (
  INSERT INTO public.sources (title, source_type, publisher, topic, canonical_url)
  VALUES ('Census 2022 statistical release (P0301.4)', 'statistical_release', 'Statistics South Africa', 'population', 'https://census.statssa.gov.za/assets/documents/2022/P03014_Census_2022_Statistical_Release.pdf')
  RETURNING id
),
v AS (
  INSERT INTO public.source_versions (source_id, version_label, published_on, reference_period, original_url, ingest_state, status, approval_basis, approved_at)
  SELECT id, 'P0301.4 · 2023', '2023-10-10', 'Census night 2 February 2022', 'https://census.statssa.gov.za/assets/documents/2022/P03014_Census_2022_Statistical_Release.pdf', 'done', 'approved', 'demonstration', now()
  FROM s RETURNING id, source_id
),
u AS (UPDATE public.sources SET current_version_id = (SELECT id FROM v) WHERE id = (SELECT source_id FROM v)),
p AS (
  INSERT INTO public.passages (source_version_id, position, page_number, section_label, content)
  SELECT v.id, 1, NULL, 'Key finding', 'Census 2022 counted a population of 62 million people in South Africa on census night, 2 February 2022.' FROM v
  RETURNING id
)
INSERT INTO public.observations (source_version_id, passage_id, measure, measure_key, value, value_state, display_value, unit, population, geography, reference_period, verified_at)
SELECT v.id, (SELECT id FROM p), 'Census population count', 'census_population_total', 62000000, 'reported', '62 million', 'people', 'All persons counted', 'South Africa', 'Census night 2 February 2022', now()
FROM v;

WITH s AS (
  INSERT INTO public.sources (title, source_type, publisher, topic, canonical_url)
  VALUES ('Quarterly Labour Force Survey, Quarter 2: 2025 (P0211)', 'statistical_release', 'Statistics South Africa', 'labour market', 'https://www.statssa.gov.za/publications/P0211/P02112ndQuarter2025.pdf')
  RETURNING id
),
v AS (
  INSERT INTO public.source_versions (source_id, version_label, published_on, reference_period, original_url, ingest_state, status, approval_basis, approved_at)
  SELECT id, 'P0211 · Q2 2025', '2025-08-12', 'Q2 2025 (April–June 2025)', 'https://www.statssa.gov.za/publications/P0211/P02112ndQuarter2025.pdf', 'done', 'approved', 'demonstration', now()
  FROM s RETURNING id, source_id
),
u AS (UPDATE public.sources SET current_version_id = (SELECT id FROM v) WHERE id = (SELECT source_id FROM v)),
p AS (
  INSERT INTO public.passages (source_version_id, position, page_number, section_label, content)
  SELECT v.id, t.position, NULL, 'Key findings', t.content FROM v
  JOIN (VALUES
    (1, 'The official unemployment rate was 33.2% in the second quarter of 2025, up 0.3 of a percentage point from 32.9% in the first quarter of 2025.'),
    (2, 'The number of unemployed persons rose to 8.4 million in Q2 2025, from 8.2 million in Q1 2025.'),
    (3, 'The expanded unemployment rate, which includes discouraged work-seekers, stood at 42.9% in Q2 2025.')
  ) AS t(position, content) ON true
  RETURNING id, position
)
INSERT INTO public.observations (source_version_id, passage_id, measure, measure_key, value, value_state, display_value, unit, population, geography, reference_period, adjustment, reported_change, verified_at)
SELECT v.id, (SELECT id FROM p WHERE position = o.position), o.measure, o.measure_key, o.value, 'reported', o.display_value, o.unit, o.population, 'South Africa', 'Q2 2025 (April–June 2025)', o.adjustment, o.reported_change, now()
FROM v
JOIN (VALUES
  (1, 'Official unemployment rate', 'unemployment_rate_official', 33.2, '33.2%', 'percent', 'Labour force aged 15–64', 'Not seasonally adjusted', 'Up 0.3 of a percentage point from 32.9% in Q1 2025'),
  (2, 'Unemployed persons', 'unemployed_persons', 8400000, '8.4 million', 'people', 'Labour force aged 15–64', 'Not seasonally adjusted', 'Up from 8.2 million in Q1 2025'),
  (3, 'Expanded unemployment rate', 'unemployment_rate_expanded', 42.9, '42.9%', 'percent', 'Labour force aged 15–64 including discouraged work-seekers', 'Not seasonally adjusted', 'Down 0.2 of a percentage point from Q1 2025')
) AS o(position, measure, measure_key, value, display_value, unit, population, adjustment, reported_change) ON true;

WITH s AS (
  INSERT INTO public.sources (title, source_type, publisher, topic, canonical_url)
  VALUES ('Consumer Price Index, September 2025 (P0141)', 'statistical_release', 'Statistics South Africa', 'prices', 'https://www.statssa.gov.za/publications/P0141/P0141September2025.pdf')
  RETURNING id
),
v AS (
  INSERT INTO public.source_versions (source_id, version_label, published_on, reference_period, original_url, ingest_state, status, approval_basis, approved_at)
  SELECT id, 'P0141 · September 2025', '2025-10-22', 'September 2025', 'https://www.statssa.gov.za/publications/P0141/P0141September2025.pdf', 'done', 'approved', 'demonstration', now()
  FROM s RETURNING id, source_id
),
u AS (UPDATE public.sources SET current_version_id = (SELECT id FROM v) WHERE id = (SELECT source_id FROM v)),
p AS (
  INSERT INTO public.passages (source_version_id, position, page_number, section_label, content)
  SELECT v.id, 1, NULL, 'Key finding', 'Annual headline consumer price inflation was 3.4% in September 2025.' FROM v
  RETURNING id
)
INSERT INTO public.observations (source_version_id, passage_id, measure, measure_key, value, value_state, display_value, unit, population, geography, reference_period, reported_change, verified_at)
SELECT v.id, (SELECT id FROM p), 'Headline CPI inflation (annual)', 'cpi_headline_yoy', 3.4, 'reported', '3.4%', 'percent (year on year)', 'All urban and rural areas', 'South Africa', 'September 2025', '3.3% in August 2025', now()
FROM v;

WITH s AS (
  INSERT INTO public.sources (title, source_type, publisher, topic, canonical_url)
  VALUES ('Gross Domestic Product, Second Quarter 2025 (P0441)', 'statistical_release', 'Statistics South Africa', 'economy', 'https://www.statssa.gov.za/publications/P0441/Press%20release%20-%20Q2%202025.pdf')
  RETURNING id
),
v AS (
  INSERT INTO public.source_versions (source_id, version_label, published_on, reference_period, original_url, ingest_state, status, approval_basis, approved_at)
  SELECT id, 'P0441 · Q2 2025', '2025-09-09', 'Q2 2025 (April–June 2025)', 'https://www.statssa.gov.za/publications/P0441/Press%20release%20-%20Q2%202025.pdf', 'done', 'approved', 'demonstration', now()
  FROM s RETURNING id, source_id
),
u AS (UPDATE public.sources SET current_version_id = (SELECT id FROM v) WHERE id = (SELECT source_id FROM v)),
p AS (
  INSERT INTO public.passages (source_version_id, position, page_number, section_label, content)
  SELECT v.id, 1, NULL, 'Key finding', 'Real gross domestic product grew by 0.8% in the second quarter of 2025 (quarter on quarter, seasonally adjusted), following growth of 0.1% in the first quarter.' FROM v
  RETURNING id
)
INSERT INTO public.observations (source_version_id, passage_id, measure, measure_key, value, value_state, display_value, unit, population, geography, reference_period, adjustment, reported_change, verified_at)
SELECT v.id, (SELECT id FROM p), 'Real GDP growth (quarter on quarter)', 'gdp_growth_qoq', 0.8, 'reported', '0.8%', 'percent (quarter on quarter)', 'Total economy', 'South Africa', 'Q2 2025 (April–June 2025)', 'Seasonally adjusted', '0.1% in Q1 2025', now()
FROM v;

WITH s AS (
  INSERT INTO public.sources (title, source_type, publisher, topic, canonical_url)
  VALUES ('Monetary Policy Committee statement, November 2025', 'media_release', 'South African Reserve Bank', 'monetary policy', 'https://www.resbank.co.za/en/home/publications/publication-detail-pages/statements/monetary-policy-statements/2025/november')
  RETURNING id
),
v AS (
  INSERT INTO public.source_versions (source_id, version_label, published_on, reference_period, original_url, ingest_state, status, approval_basis, approved_at)
  SELECT id, 'MPC statement · November 2025', '2025-11-20', 'Effective 20 November 2025', 'https://www.resbank.co.za/en/home/publications/publication-detail-pages/statements/monetary-policy-statements/2025/november', 'done', 'approved', 'demonstration', now()
  FROM s RETURNING id, source_id
),
u AS (UPDATE public.sources SET current_version_id = (SELECT id FROM v) WHERE id = (SELECT source_id FROM v)),
p AS (
  INSERT INTO public.passages (source_version_id, position, page_number, section_label, content)
  SELECT v.id, 1, NULL, 'Decision', 'The Monetary Policy Committee of the South African Reserve Bank decided unanimously to reduce the repurchase rate to 6.75%, effective 20 November 2025.' FROM v
  RETURNING id
)
INSERT INTO public.observations (source_version_id, passage_id, measure, measure_key, value, value_state, display_value, unit, population, geography, reference_period, verified_at)
SELECT v.id, (SELECT id FROM p), 'Repurchase (repo) rate', 'repo_rate', 6.75, 'reported', '6.75%', 'percent per annum', NULL, 'South Africa', 'Effective 20 November 2025', now()
FROM v;

WITH s AS (
  INSERT INTO public.sources (title, source_type, publisher, topic, canonical_url)
  VALUES ('General Household Survey, 2023 (P0318)', 'statistical_release', 'Statistics South Africa', 'households', 'https://www.statssa.gov.za/publications/P0318/P03182023.pdf')
  RETURNING id
),
v AS (
  INSERT INTO public.source_versions (source_id, version_label, published_on, reference_period, original_url, ingest_state, status, approval_basis, approved_at)
  SELECT id, 'P0318 · 2023', '2024-05-23', '2023', 'https://www.statssa.gov.za/publications/P0318/P03182023.pdf', 'done', 'approved', 'demonstration', now()
  FROM s RETURNING id, source_id
),
u AS (UPDATE public.sources SET current_version_id = (SELECT id FROM v) WHERE id = (SELECT source_id FROM v)),
p AS (
  INSERT INTO public.passages (source_version_id, position, page_number, section_label, content)
  SELECT v.id, t.position, NULL, 'Key findings', t.content FROM v
  JOIN (VALUES
    (1, 'In 2023, 42.3% of households in South Africa were headed by females. The share was highest in Eastern Cape (48.8%) and lowest in Gauteng (36.5%).'),
    (2, 'Receipt of social grants rose to 39.4% of households/individuals in 2023, up from 30.9% in 2019.')
  ) AS t(position, content) ON true
  RETURNING id, position
)
INSERT INTO public.observations (source_version_id, passage_id, measure, measure_key, value, value_state, display_value, unit, population, geography, reference_period, reported_change, verified_at)
SELECT v.id, (SELECT id FROM p WHERE position = o.position), o.measure, o.measure_key, o.value, 'reported', o.display_value, o.unit, o.population, o.geography, '2023', o.reported_change, now()
FROM v
JOIN (VALUES
  (1, 'Female-headed households', 'households_female_headed_share', 42.3, '42.3%', 'percent of households', 'All households', 'South Africa', NULL::text),
  (2, 'Social grant recipiency', 'social_grant_recipiency', 39.4, '39.4%', 'percent', 'Households/individuals', 'South Africa', 'Up from 30.9% in 2019')
) AS o(position, measure, measure_key, value, display_value, unit, population, geography, reported_change) ON true;

WITH s AS (
  INSERT INTO public.sources (title, source_type, publisher, topic, canonical_url)
  VALUES ('Budget Overview, May 2025', 'other', 'National Treasury', 'public finances', 'https://www.treasury.gov.za/documents/National%20Budget/2025May/review/May%202025%20Budget%20Overview.pdf')
  RETURNING id
),
v AS (
  INSERT INTO public.source_versions (source_id, version_label, published_on, reference_period, original_url, ingest_state, status, approval_basis, approved_at)
  SELECT id, 'Budget Overview · May 2025', '2025-05-21', '2025/26 fiscal year', 'https://www.treasury.gov.za/documents/National%20Budget/2025May/review/May%202025%20Budget%20Overview.pdf', 'done', 'approved', 'demonstration', now()
  FROM s RETURNING id, source_id
),
u AS (UPDATE public.sources SET current_version_id = (SELECT id FROM v) WHERE id = (SELECT source_id FROM v)),
p AS (
  INSERT INTO public.passages (source_version_id, position, page_number, section_label, content)
  SELECT v.id, 1, NULL, 'Consolidated fiscal framework', 'The May 2025 Budget projects a consolidated budget deficit of 4.8% of GDP for 2025/26, narrowing to 3.4% of GDP by 2027/28.' FROM v
  RETURNING id
)
INSERT INTO public.observations (source_version_id, passage_id, measure, measure_key, value, value_state, display_value, unit, population, geography, reference_period, reported_change, verified_at)
SELECT v.id, (SELECT id FROM p), 'Consolidated budget balance', 'budget_balance_gdp', -4.8, 'reported', '-4.8% of GDP', 'percent of GDP', 'Consolidated national and provincial government', 'South Africa', '2025/26 fiscal year', 'Projected to narrow to -3.4% of GDP by 2027/28', now()
FROM v;

INSERT INTO public.audit_events (actor_role, action, entity_kind, detail, origin)
VALUES (
  'system',
  'knowledge_base_seeded',
  'knowledge_base',
  '{"sources": 8, "basis": "demonstration", "note": "Real published South African statistics seeded as approved demonstration sources; the crawler proposes further publications for human approval."}'::jsonb,
  'system'
);