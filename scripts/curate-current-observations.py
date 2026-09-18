"""Curated reported figures; does not verify, approve, or write to the database."""
import calendar
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / 'output' / 'knowledge-base'
PACK = json.loads((ROOT / 'pack.json').read_text())
SOURCES = {s['key']: s for s in PACK['sources']}
OUT = {}


def add(source, position, key, measure, value, display, unit='percent', period=None,
        population=None, geography='South Africa', adjustment=None, note=None,
        change=None, dates=None):
    src = SOURCES[source]
    passage = next(p for p in src['passages'] if p['position'] == position)
    period = period or src['reference_period']
    if dates is None:
        dates = (None, None)
        if period in ['2025', '2026', '2015', '2023']:
            dates = (f'{period}-01-01', f'{period}-12-31')
        elif period in ['July 2026', 'June 2026', 'March 2026', 'February 2026']:
            month = {'July':7,'June':6,'March':3,'February':2}[period.split()[0]]
            dates = (f'2026-{month:02d}-01', f'2026-{month:02d}-{calendar.monthrange(2026, month)[1]}')
        elif period == 'Q2 2026':
            dates = ('2026-04-01', '2026-06-30')
        elif period == 'Three months ended July 2026':
            dates = ('2026-05-01', '2026-07-31')
    OUT.setdefault(source, []).append({
        'measure': measure, 'measure_key': key, 'value': value, 'value_state': 'reported',
        'display_value': display, 'unit': unit, 'population': population,
        'geography': geography, 'reference_period': period, 'period_start': dates[0],
        'period_end': dates[1], 'adjustment': adjustment, 'reported_change': change,
        'comparability_note': note, 'page_number': passage['page_number'], 'table_label': None,
        'evidence_text': passage['content'], 'position': position,
    })

s = 'population-2026-findings'
popnote = 'Mid-year population estimate. Rounded million-person values remain in millions; they are not exact person counts.'
for pos,key,title,value,display,unit,pop,geo in [
 (0,'population_midyear','Mid-year population estimate',63.52,'63,52 million','million people',None,'South Africa'),
 (0,'female_population_share','Female share of the population',50.9,'50,9%','percent','Female population','South Africa'),
 (0,'female_population_midyear','Female population estimate',32.3,'approximately 32,3 million','million people','Female population','South Africa'),
 (0,'life_expectancy_male','Life expectancy at birth, males',65.5,'65,5 years','years','Males','South Africa'),
 (0,'life_expectancy_female','Life expectancy at birth, females',71.0,'71,0 years','years','Females','South Africa'),
 (0,'life_expectancy_total','Life expectancy at birth, total',68.3,'68,3 years','years',None,'South Africa'),
 (1,'population_midyear','Mid-year population estimate',16.30,'approximately 16,30 million','million people',None,'Gauteng'),
 (1,'population_midyear','Mid-year population estimate',12.28,'estimated 12,28 million','million people',None,'KwaZulu-Natal'),
 (1,'population_midyear','Mid-year population estimate',1.38,'approximately 1,38 million','million people',None,'Northern Cape'),
 (2,'population_under15_share','Population share aged younger than 15 years',25.6,'25,6%','percent','Population aged younger than 15 years','South Africa'),
 (2,'population_under15','Population aged younger than 15 years',16.25,'16,25 million','million people','Population aged younger than 15 years','South Africa'),
 (2,'population_60plus_share','Population share aged 60 years or older',10.7,'10,7%','percent','Population aged 60 years or older','South Africa'),
 (2,'population_60plus','Population aged 60 years or older',6.79,'6,79 million','million people','Population aged 60 years or older','South Africa'),
]: add(s,pos,key,title,value,display,unit,period='2026',population=pop,geography=geo,note=popnote)
for geo,value,display in [('Gauteng',1420447,'approximately 1 420 447'),('Western Cape',500093,'approximately 500 093')]:
 add(s,0,'estimated_migrant_inflow','Estimated inflow of migrants',value,display,'people',period='2021–2026',geography=geo,note='Estimated inflow over the stated 2021–2026 period, not an annual count. Exact boundary dates are not stated in these findings.')

s = 'ghs-2025-findings'
for pos,key,title,value,display,unit,pop in [
 (0,'social_grant_individual_share','Individuals benefiting from social grants',39.5,'39,5%','percent','Individuals'),
 (0,'social_grant_household_share','Households containing at least one grant recipient',50.6,'50,6%','percent','Households'),
 (1,'medical_aid_coverage_share','Individuals with medical aid coverage',15.5,'15,5%','percent','Individuals'),
 (1,'medical_aid_covered_population','Individuals with medical aid coverage',10.0,'10,0 million individuals','million individuals','Individuals'),
 (2,'mains_electricity_access','National access to mains electricity',90.6,'90,6%','percent',None),
 (2,'wood_cooking_share','Use of wood for cooking',8.0,'8,0%','percent',None),
 (2,'lpg_gas_cooking_share','Use of LPG/Gas for cooking',9.4,'9,4%','percent',None),
 (3,'piped_water_access_households','Households with access to piped water in dwelling, yard or communal tap',87.4,'87,4%','percent','Households'),
 (3,'improved_sanitation_households','Households with access to improved sanitation',84.0,'84,0%','percent','Households'),
 (4,'inadequate_food_access_households','Households considering food access inadequate or severely inadequate',22.0,'22,0%','percent','Households'),
]: add(s,pos,key,title,value,display,unit,period='2025',population=pop,note='General Household Survey estimate. Population denominator is not expanded beyond what the findings state.')
add(s,4,'food_access_inadequacy_change_since2019','Increase since 2019 in households reporting inadequate or severely inadequate food access',4.2,'4,2 percentage points','percentage points',period='2025',population='Households',change='4,2 percentage points higher than in 2019 before the outbreak of COVID-19.',note='Percentage-point change as reported; not a percentage change or a derived 2019 baseline.')

s = 'qes-2026-q1-findings'
qnote = 'Quarterly Employment Statistics (QES) measure; not interchangeable with QLFS employment or unemployment rates. Reference month and comparison basis are retained as reported.'
for pos,key,title,value,display,unit,period,change in [
 (0,'qes_total_employment','QES total employment',10468000,'10 468 000','employees','March 2026','Total employment decreased by 80 000 or -0,8% quarter-on-quarter, from 10 548 000 in December 2025 to 10 468 000 in March 2026.'),
 (0,'qes_total_employment_qoq_change','QES total employment quarter-on-quarter percentage change',-0.8,'-0,8%','percent','March 2026',None),
 (1,'qes_total_employment_yoy_change','QES total employment year-on-year percentage change',-1.1,'-1,1%','percent','March 2026',None),
 (2,'qes_fulltime_employment','QES full-time employment',9409000,'9 409 000','employees','March 2026',None),
 (5,'qes_parttime_employment','QES part-time employment',1059000,'1 059 000','employees','March 2026',None),
 (7,'qes_gross_earnings','Gross earnings paid to employees',1.04,'R1,04 trillion','trillion rand','March 2026',None),
 (8,'qes_gross_earnings_yoy_change','Gross earnings year-on-year percentage change',5.2,'5,2%','percent','March 2026',None),
 (9,'qes_basic_wages','Basic salary/wages paid to employees',921.5,'R921,5 billion','billion rand','March 2026',None),
 (11,'qes_bonus_payments','Bonuses paid to employees',85.3,'R85,3 billion','billion rand','March 2026',None),
 (13,'qes_overtime_payments','Overtime paid to employees',29.2,'R29,2 billion','billion rand','March 2026',None),
 (15,'qes_average_monthly_earnings','Average monthly earnings paid to employees',29997,'R29 997','rand per month','February 2026',None),
 (16,'qes_average_monthly_earnings_yoy_change','Average monthly earnings year-on-year percentage change',5.9,'5,9%','percent','February 2026',None),
]: add(s,pos,key,title,value,display,unit,period=period,population=None,note=qnote + (' Earnings accrual start/end dates are not specified in these findings; March is the release reference period, not a claim that the total is monthly.' if pos in (7,8,9,11,13) else ''),change=change,dates=(None,None) if pos in (7,8,9,11,13) else None)

s = 'cpi-2026-07-findings'
for pos,key,title,value,display,period in [(1,'cpi_annual_inflation','Annual consumer price inflation',4.3,'4,3%','July 2026'),(1,'cpi_annual_inflation','Annual consumer price inflation',5.0,'5,0%','June 2026'),(2,'cpi_monthly_change','CPI month-on-month change',0.2,'0,2%','July 2026')]:
 add(s,pos,key,title,value,display,period=period,population='All urban areas',note='Headline CPI for all urban areas, as identified in the source heading. Annual inflation and month-on-month index change are distinct measures.')
s = 'ppi-2026-07-findings'
add(s,0,'ppi_final_manufacturing_annual_inflation','Annual producer price inflation, final manufacturing',5.7,'5,7%',period='July 2026',population='Final manufacturing',note='Final manufacturing PPI, not CPI.')
add(s,0,'ppi_final_manufacturing_monthly_change','Producer price index month-on-month change, final manufacturing',-1.0,'-1,0%',period='July 2026',population='Final manufacturing',note='Final manufacturing PPI, not CPI.')

s = 'electricity-2026-07-findings'
for pos,kind,yoy,monthly,three in [(0,'generation',-7.9,-0.4,-1.3),(1,'distribution',-2.6,0.3,1.2)]:
 label = 'Electricity generation (production)' if kind=='generation' else 'Electricity distribution (consumption)'
 for suffix,title,value,period,adj in [('yoy_change','year-on-year change',yoy,'July 2026',None),('mom_change','month-on-month change',monthly,'July 2026','Seasonally adjusted'),('three_month_change','change against previous three months',three,'Three months ended July 2026','Seasonally adjusted')]:
  add(s,pos,f'electricity_{kind}_{suffix}',f'{label} {title}',value,f'{value:.1f}%'.replace('.',','),period=period,adjustment=adj,note='Generation and distribution are separate series; comparison periods are not interchangeable.')

s = 'mining-2026-07-findings'
for pos,key,title,value,period,adj in [
 (0,'mining_production_yoy_change','Mining production year-on-year change',-7.5,'July 2026',None),
 (4,'mining_production_mom_change','Mining production month-on-month change',-1.9,'July 2026','Seasonally adjusted'),
 (5,'mining_production_three_month_change','Mining production change against previous three months',-5.5,'Three months ended July 2026','Seasonally adjusted'),
 (10,'mineral_sales_yoy_change','Mineral sales at current prices year-on-year change',-5.6,'July 2026','Current prices'),
 (15,'mineral_sales_mom_change','Mineral sales at current prices month-on-month change',-15.1,'July 2026','Seasonally adjusted; current prices'),
 (16,'mineral_sales_three_month_change','Mineral sales at current prices change against previous three months',-10.0,'Three months ended July 2026','Seasonally adjusted; current prices'),
]:add(s,pos,key,title,value,f'{value:.1f}%'.replace('.',','),period=period,adjustment=adj,note='Production and sales are distinct series; sales are explicitly at current prices.')

s = 'manufacturing-2026-07-findings'
for pos,key,title,value,period,adj in [
 (0,'manufacturing_production_yoy_change','Manufacturing production year-on-year change',1.1,'July 2026',None),
 (1,'manufacturing_production_mom_change','Manufacturing production month-on-month change',2.2,'July 2026','Seasonally adjusted'),
 (2,'manufacturing_production_three_month_change','Manufacturing production change against previous three months',1.0,'Three months ended July 2026','Seasonally adjusted'),
 (6,'manufacturing_sales_mom_change','Manufacturing sales month-on-month change',3.9,'July 2026','Seasonally adjusted'),
]:add(s,pos,key,title,value,f'{value:.1f}%'.replace('.',','),period=period,adjustment=adj,note='Production and sales are separate series. No price basis is inferred where not stated in these findings.')

s = 'retail-2026-07-findings'
for pos,key,title,value,period,adj in [
 (0,'retail_sales_yoy_change','Retail trade sales year-on-year change',3.4,'July 2026','Real terms; constant 2019 prices'),
 (5,'retail_sales_mom_change','Retail trade sales month-on-month change',2.5,'July 2026','Seasonally adjusted; real terms; constant 2019 prices'),
 (6,'retail_sales_three_month_yoy_change','Retail trade sales three-month year-on-year change',2.2,'Three months ended July 2026','Real terms; constant 2019 prices'),
 (9,'retail_sales_three_month_change','Retail trade sales change against previous three months',1.0,'Three months ended July 2026','Seasonally adjusted; real terms; constant 2019 prices'),
]:add(s,pos,key,title,value,f'{value:.1f}%'.replace('.',','),period=period,adjustment=adj,note='The findings identify retail sales in real terms at constant 2019 prices. Three-month annual and previous-three-month comparisons differ.')

s = 'crime-2026-findings'
cnote = 'Victims of Crime survey estimate, not police-recorded crime totals. Incidences, affected households/individuals, and reporting shares have different denominators. Exact 2025/26 start/end dates are not stated in these findings.'
for pos,key,title,value,display,unit,pop in [
 (0,'housebreaking_affected_households','Households affected by housebreaking',1.08,'1,08 million households','million households','Households'),
 (0,'housebreaking_household_share','Households affected by housebreaking as share of all households',5.3,'5,3%','percent','All households'),
 (0,'housebreaking_police_reporting_share','Households reporting some or all housebreaking incidences to police',48.2,'48,2%','percent','Households that experienced housebreaking'),
 (1,'home_robbery_affected_households','Households that experienced home robbery',179000,'179 000 households','households','Households'),
 (1,'home_robbery_household_share','Households affected by home robbery as share of all households',0.9,'0,9%','percent','All households'),
 (1,'home_robbery_police_reporting_share','Households reporting some or all home robbery incidences to police',51.6,'51,6%','percent','Households that experienced home robbery'),
 (2,'personal_property_theft_incidences','Estimated incidences of theft of personal property',1.4,'estimated 1,4 million incidences','million incidences','Individuals aged 16 years and older'),
 (2,'personal_property_theft_affected_individuals','Individuals affected by theft of personal property',1.2,'1,2 million individuals','million individuals','Individuals aged 16 years and older'),
 (2,'personal_property_theft_individual_share','Individuals affected by theft of personal property as share of those aged 16 years and older',2.6,'2,6%','percent','Individuals aged 16 years and older'),
 (2,'personal_property_theft_police_reporting_share','Individuals reporting some or all personal property theft incidences to police',37.3,'37,3%','percent','Individuals who experienced theft of personal property'),
 (3,'street_robbery_affected_individuals','Individuals that experienced street robbery',459000,'459 000 individuals','individuals','Individuals'),
 (3,'street_robbery_incidences','Estimated street robbery incidences',515000,'estimated 515 000 incidences','incidences',None),
 (4,'psychological_violence_affected_individuals','Individuals that experienced psychological violence',264000,'264 000 individuals','individuals','Individuals aged 16 years and older'),
 (6,'neighbourhood_daytime_safety_share','Individuals feeling safe walking alone in their neighbourhood during the day',80.7,'80,7%','percent','Individuals aged 16 years and older'),
 (6,'neighbourhood_dark_safety_share','Individuals feeling safe walking alone in their neighbourhood when it is dark',37.9,'37,9%','percent','Individuals aged 16 years and older'),
]:add(s,pos,key,title,value,display,unit,period='2025/26',population=pop,note=cnote)

s = 'subjective-poverty-findings'
for pos,key,title,first,last in [(4,'subjective_poverty_income_evaluation','Subjective poverty headcount: income evaluation indicator',49.7,51.4),(5,'subjective_poverty_minimum_income','Subjective poverty headcount: minimum income indicator',50.6,41.3),(5,'subjective_poverty_self_perceived_wealth','Subjective poverty headcount: self-perceived wealth indicator',34.4,25.7)]:
 for year,value in [('2015',first),('2023',last)]:
  add(s,pos,key,title,value,f'{value:.1f}%'.replace('.',','),period=year,note='Subjective poverty indicator drawn from LCS 2014/15 and IES 2022/23. This is not an official national monetary poverty-line headcount; the three subjective indicators are distinct. Year labels follow the findings.')

s = 'gdp-2026-q2-findings'
gnote = 'Quarterly GDP finding. Seasonal adjustment and annualisation are not stated for this growth figure in the cited key-findings passage and are not assumed.'
for pos,key,title,value,unit,adj in [
 (2,'gdp_production_growth','GDP measured by production, Q2 change',-0.2,'percent',None),
 (3,'gdp_trade_catering_accommodation_growth','Trade, catering and accommodation industry growth',-1.9,'percent',None),
 (4,'gdp_manufacturing_growth','Manufacturing industry growth',-1.8,'percent',None),
 (5,'gdp_mining_quarrying_growth','Mining and quarrying industry growth',-3.0,'percent',None),
 (10,'gdp_real_expenditure_growth','Expenditure on real GDP, Q2 change',-0.2,'percent','Real GDP'),
 (17,'gdp_net_exports_contribution','Net exports contribution to expenditure on GDP growth',-1.1,'percentage points',None),
]:add(s,pos,key,title,value,f'{value:.1f}'.replace('.',',')+('%' if unit=='percent' else ' percentage points'),unit,period='Q2 2026',adjustment=adj,note=gnote)

# No IDs, verification timestamps, or approval metadata are produced.
for source, observations in OUT.items():
    facts = set()
    for o in observations:
        passage = next(p for p in SOURCES[source]['passages'] if p['position'] == o['position'])
        assert o['evidence_text'] == passage['content']
        assert o['page_number'] == passage['page_number']
        fact = (o['measure_key'], o['geography'], o['reference_period'], o['population'])
        assert fact not in facts, (source, fact)
        facts.add(fact)
(ROOT / 'current-observations.json').write_text(json.dumps(OUT, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'sources': len(OUT), 'observations': sum(map(len, OUT.values())), 'by_source': {k:len(v) for k,v in OUT.items()}}, indent=2))
