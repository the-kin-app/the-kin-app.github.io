# Min: independent business-model assessment
14 September 2026

## Verdict

Min has a credible user proposition and a plausible route to a sustainable business. The current plan does not establish that route economically, and its fast, self-funding European rollout is not a sound base case.

The most defensible proposition is permission and coordination: finding someone nearby who actually wants to meet. The weakest commercial version is a free, spontaneous, one-to-one service funded primarily by café walk-ins. Group activities and a paid coordination product could materially improve it, but are additional product bets.

This is a review of the local homepage, merchant concept page, business plan, financial model, beachhead plan, product principles, Moments specification, product index and implementation overview/milestones. It is not a live-app usability test or an audit of customer telemetry. Several older implementation specifications conflict with newer product decisions. I treat the current homepage and recent product decisions as the intended proposition; I found no measured operating cohorts in the materials reviewed.

## First principles

The user wants an enjoyable, safe meeting at a convenient time, without rejection or extensive coordination. AI matching can help, but does not create simultaneous availability. Better personality inference cannot rescue an empty local pool.

The merchant buys incremental contribution profit, not visits as such. A visit can be accurately attributed to a suggestion without being incremental: the person might have visited anyway. Naming a venue before arrival establishes sequence, not the counterfactual. A 30-day cooldown avoids repeat billing but does not establish incrementality.

A subscription buyer needs a recurring advantage. If the free product reliably introduces people, willingness to buy priority is uncertain. If priority becomes necessary for acceptable matches, the free experience and network growth suffer. Successful users can also graduate out of the product; society benefits while recurring revenue ends.

Institutions may buy community programmes, but population-level loneliness costs are not evidence that Min saves a buyer money. Institutional contracts and sponsorship are separate sales motions, with delivery and measurement costs. I exclude both from the independent core model.

Local density can be defensible once it exists. The AI persona and anti-feed positioning are weaker standalone barriers: incumbents can build adjacent products, and users can use several services simultaneously. The durable advantage would be a trusted local network that consistently produces worthwhile meetings.

## Corrections to the existing plan

1. Section 5 still cites about €1.43m annually at 40,000 MAU, while revised section 8.5 totals approximately €670k, including €120k enterprise and €230k consumer billings. Section 8.3 separately adds roughly €70k of merchant base fees. These are different cases, not interchangeable estimates.
2. The plan explicitly retires the sponsored-Memo funnel that supported €27 of merchant revenue per user annually. Its replacement implies approximately €8 at 40,000 MAU.
3. Saying the entire difference is frequency is incomplete. Moving 0.7 visits to 0.467 is a 33% reduction; moving €27 ARPU to €8 is a 70% reduction. Price/mix/fee assumptions also differ: €27/(0.7×12)=€3.21 per visit, while €8/(0.467×12)=€1.43.
4. The 6,480 spontaneous upgrades appear consistent with 40,000 users × 30 offer exposures ÷ 2 × 4.5% joint acceptance × 50% partner share × 48% upgrade. The division by two is appropriate if each pair consumes two user exposures. But the table does not separately expose attendance, successful attribution, or cooldown leakage. Define whether its rates already incorporate these; otherwise they need additional factors.
5. Consumer billings are not spendable revenue. The model should separate VAT, store charges, refunds, contribution costs and overhead.
6. Monthly merchant budgets cap spending; they do not guarantee it. Adding a platform fee to outcome fees requires evidence that merchants will pay both and clear treatment of any included visit allowance.
7. Launch payback uses mature-city economics against the cost of an initial seed population. The path from 10,000 to 40,000 retained users is not free. Mature gross profit also funds salaries, retention acquisition and local operations.
8. Penetration does not cause revenue to grow quadratically forever. Candidate supply can initially rise rapidly, but human time, relevance, repeat partners and notification tolerance cap throughput.
9. The visible product focuses on one-to-one introductions, while the commercial plan depends materially on groups and premium features. The MVP cannot validate revenue from functionality it does not deliver.

## Independent model

All figures below are scenario assumptions, not forecasts or market benchmarks. Scale refers to average monthly active users maintained for a full year, not year-end users or downloads.

An offer exposure is one user's exposure to a potential pair. Two exposures create one pair proposal. Two people per successful meeting cancel that division when counting delivered heads.

Spontaneous billable visits per MAU-month =
offer exposures × joint acceptance × meeting completion × partner share × venue upgrade × attribution capture × cooldown eligibility.

Group billable visits =
completed attendances at paying partner venues per MAU-month × attribution capture × cooldown eligibility.

The group input already includes event formation, turnout and partner selection. It does not mean RSVPs. Both lines must be deduplicated operationally.

| Assumption | Weak | Moderate | Strong |
|---|---:|---:|---:|
| Offer exposures per MAU/month | 12 | 20 | 30 |
| Both people accept | 3% | 4.5% | 7% |
| Accepted meetings actually happen | 65% | 75% | 85% |
| Meetings at partner spots | 35% | 50% | 65% |
| Completed pairs go inside | 35% | 45% | 50% |
| Attribution capture | 50% | 65% | 80% |
| Eligible after cooldown | 75% | 80% | 85% |
| Completed group partner attendances/MAU/month | 0.10 | 0.35 | 0.80 |
| Paying subscribers/MAU | 1% | 3% | 6% |
| Variable service cost/MAU/month | €0.25 | €0.20 | €0.25 |
| Monthly active-user loss, before replacement | 12% | 6% | 4% |
| Blended cost per replacement active | €12 | €8 | €6 |

Prices: €1.25 per spontaneous head and €1.84 per group head, drawn from the revised plan as testable assumptions. Subscription: €7.99 retail, divided by 1.255 for Finnish VAT, then multiplied by 80% for an illustrative blended store fee. The 20% fee is a planning assumption, not a claim about a particular Apple contract. Merchant prices are assumed ex-VAT. Merchant payment/bad-debt allowance: 3%.

Variable service costs cover inference, infrastructure and usage-linked support/moderation, with higher heavy-user cost in the strong scenario. These are deliberately broader than inference-only estimates, and require telemetry. Fixed personnel and city operations are separate.

“Net receipts” below means merchant fees plus consumer proceeds after VAT and store fees, before other costs. It is a cash-economics measure, not a formal accounting revenue policy.

| Result per MAU | Weak | Moderate | Strong |
|---|---:|---:|---:|
| Billable venue visits/month | 0.048 | 0.261 | 0.938 |
| Annual net receipts | €1.60 | €7.04 | €21.60 |
| Monthly contribution before acquisition and fixed costs | €-0.12 | €0.37 | €1.50 |
| Monthly replacement-acquisition cost | €1.44 | €0.48 | €0.24 |
| Monthly surplus after replacement, before fixed costs | €-1.56 | €-0.11 | €1.26 |

## Potential at different scales

Annual net receipts, assuming each local cluster sustains the corresponding behaviour:

| Average MAU | Weak | Moderate | Strong |
|---|---:|---:|---:|
| 1,000 | €1,600 | €7,037 | €21,596 |
| 10,000 | €16,004 | €70,367 | €215,959 |
| 40,000 | €64,017 | €281,470 | €863,837 |
| 100,000 | €160,043 | €703,675 | €2,159,592 |
| 1,000,000 | €1,600,428 | €7,036,747 | €21,595,919 |

These are deliberately linear within a behavioural case. New cities do not automatically inherit the strong case. No enterprise, sponsorship or extra merchant subscription fees are included.

At 40,000 MAU:
- Moderate: approximately €281k receipts, €179k contribution before acquisition, and €230k annual replacement acquisition. Negative approximately €51k before any fixed salaries or city operations.
- Strong: approximately €864k receipts, €722k contribution before acquisition, and €115k replacement acquisition. Approximately €607k remains for fixed expenses and profit.
- With illustrative fixed costs of €500k/year for a lean company plus one city's operations, strong-case profit is approximately €107k before tax, financing and expansion. Moderate-case loss is approximately €551k. Founder market compensation belongs in those fixed costs.

At 100,000 MAU, strong-case surplus after replacement is approximately €1.52m before central and city fixed costs. At 1m MAU it is approximately €15.18m. For illustration, 25 cities × €150k ongoing annual local cost plus €5m central cost leaves approximately €6.43m operating surplus. These budgets are independent planning allowances, not researched wage quotations. Additional launch/growth investment is excluded.

A €100m annual net-receipts business requires approximately 4.63m average MAU at strong economics, or 14.21m at moderate economics. The strong case is possible as a success scenario; it is not justified merely by counting eligible cities.

## The one-to-one-only business is smaller

Removing group revenue while retaining the same subscription conversion yields:
- Moderate: approximately €3.02 annual receipts/MAU, or €121k at 40k MAU.
- Strong: approximately €9.58 annual receipts/MAU, or €383k at 40k MAU.

Groups provide about 77% of merchant receipts in the moderate case and 67% in the strong case. Retaining the same premium conversion without groups may itself be generous. The one-to-one merchant line alone contributes approximately €47k and €237k annually at 40k MAU in those two cases.

This does not make the product invalid. It means one-to-one introductions may be the acquisition and trust product, with coordinated experiences doing more of the commercial work.

## Merchant willingness to pay

Illustrative economics per attributed café arrival:
70% purchase probability × €5 contribution per purchasing customer × 50% incremental share = €1.75 expected incremental contribution before the offer and Min fee.

If a €1 discount is redeemed by 70% of arrivals, expected discount cost is €0.70. A €0.75 Min fee leaves €0.30. At 30% incrementality, expected contribution falls to €1.05 and the same costs leave minus €0.40.

This is a sensitivity example, not observed merchant behaviour. It shows why ticket × food gross margin alone is inadequate. Use ex-tax tickets, purchase probability, incremental contribution after variable costs, offer cost, and any displacement of ordinary customers.

At moderate economics, 40k MAU deliver about €17.3k monthly merchant revenue: enough for roughly 116 accounts averaging €150/month. Strong economics deliver €59.8k: roughly 398 such accounts. A €150 account requires about 100 billable arrivals monthly at a €1.50 blended fee. Adding merchants divides finite traffic unless it also increases useful meeting opportunities.

Concentrating venues improves account economics but can increase walking distance and repeat-customer cooldown exclusions. Measure this tradeoff locally.

## Retention, acquisition and liquidity

Under a simple constant-loss model:
contribution LTV = monthly contribution / monthly active-user loss.

Moderate LTV is about €6.22 before fixed costs; an €8 active CAC is already too high. Strong LTV is about €37.62; a €6 CAC is attractive. A 3:1 contribution-LTV/CAC discipline implies maximum CAC of about €2.07 and €12.54 respectively. Weak economics have negative unit contribution and no positive acquisition budget.

This is a sensitivity model. Real retention curves, paid-user retention, reactivation and channel mix must be modelled by cohort. D30 alone cannot establish lifetime value. Replacement CAC here is blended across paid, organic and reactivation sources, including delivery costs; free organic acquisition would improve the result.

At 40k MAU and 6% monthly loss, 2,400 replacement actives are needed every month. At €8 each, that is €19,200/month just to maintain scale. Annual student intake is useful but does not solve this continuously.

Density must be measured as available compatible people. Example: 700 local MAU × 25% active that day × 20% in the relevant place/time × 40% currently willing to meet × 20% mutually suitable = 2.8 potential counterparts. If willingness falls to 10%, it becomes 0.7. These are illustrative filters, not measured probabilities, and correlated filters would need joint measurement.

Scheduling or recurring group windows pools availability. This is a meaningful economic advantage over fully spontaneous matching. Timeleft explicitly bundles booking and coordination with its matching product.

## What I would test before a broad rollout

1. One bounded community, with the first worthwhile meeting as the activation event. Track time-to-meeting, completion, safety feedback and a second completed meeting within 30 days.
2. Separately run one-to-one and group cohorts. Measure completed meetings and billable partner heads per MAU, not pooled successes or notification acceptance alone.
3. Use a small number of paying venues. Test actual invoices and three paid renewals; stated willingness to pay does not establish a customer.
4. Estimate incrementality using randomised venue/time encouragement or comparable holdout periods where feasible. Account for contamination and distinguish proof of arrival from incremental purchasing.
5. Test subscription purchases at the proposed price. Judge conversion against MAU, not trial starts or installs, and track paid retention separately.
6. Cost acquisition per retained active and per repeat meeting, including founder/ambassador effort. Test ongoing acquisition outside orientation week.
7. Fit economics from 90–180 days of cohorts, allowing for seasonality and uncertainty. Expand one additional polygon only after the first has an affordable maintenance cost.
8. Test a non-founder-operated launch before treating replication as proven.

The strong case implies roughly 0.94 billable venue heads/MAU/month and 6% paid penetration; the moderate case implies 0.26 and 3%. Those are useful commercial targets to interrogate, not arbitrary pass/fail gates. Lower activity can still work with higher willingness to pay, lower service costs or substantially cheaper acquisition.

## Recommendation

Proceed as a focused product experiment. Do not treat the current city-rollout forecast as a validated business model.

Keep the free introduction compelling. Test paid coordination and small group experiences early, since they can create a clearer recurring purchase and more merchant value. Treat merchant fees as proven only when incremental value, collection and renewal are observed. Keep institutional revenue out of the base case until contracts and delivery margins exist.

My judgment: a lean sustainable business is plausible; a profitable multi-city company requires strong recurring use and distribution; a venture-scale outcome is a credible upside requiring several million retained users and repeatable local operations. The mission is compelling, but economic evidence must come from meetings, paid renewals and cohort contribution.

## Sources and boundaries

Local sources:
- /Users/nao/Desktop/kin-site/index.html
- /Users/nao/Desktop/kin-site/business/index.html
- /Users/nao/Desktop/min-brain/Business/business plan.md
- /Users/nao/Desktop/min-brain/Business/Money/financial model.md
- /Users/nao/Desktop/min-brain/Business/Market/beachhead plan.md
- /Users/nao/Desktop/min-brain/Product/Principles.md
- /Users/nao/Desktop/min-brain/Product/Features/Moments.md
- /Users/nao/Desktop/min-brain/Product/Index.md
- /Users/nao/Documents/kin/docs/human_facing_specs/00-overview.md
- /Users/nao/Documents/kin/MILESTONES.md

External primary sources checked:
- [Finnish Tax Administration: VAT rates](https://www.vero.fi/en/businesses-and-corporations/taxes-and-charges/vat/rates-of-vat/) — general VAT 25.5%, used for the Finnish subscription illustration.
- [Apple Small Business Program](https://developer.apple.com/app-store/small-business-program/) — 15% commission for qualifying participants; this is not a universal rate across all scale and terms.
- [Apple EU payment options](https://developer.apple.com/support/payment-options-on-the-app-store-in-the-eu) — fee structure depends on applicable terms; the model's 20% is an explicit blended assumption.
- [Timeleft: dinners with strangers](https://timeleft.com/dinners-with-strangers/) — product includes restaurant booking, matching and conversation assistance. Used to distinguish paid coordination from spontaneous discovery.
- [RevenueCat: State of Subscription Apps 2025](https://www.revenuecat.com/state-of-subscription-apps-2025) — Social & Lifestyle retention is challenging; its subscriber benchmarks do not directly estimate Min's MAU conversion or retention.

The plan's competitor revenue, take rates, city counts and mortality/economic-cost claims were not independently validated here and are not inputs to the independent model. No valuation or fundraising instrument recommendation is made.

