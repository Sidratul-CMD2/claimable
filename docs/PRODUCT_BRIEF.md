# MASTER PRODUCT BRIEF
## Global Software Deals, Coupons & Student Offers Discovery Platform

**Document Type:** Product Vision, UX Specification & Technical Requirements  
**Version:** 1.0 — Initial Product Definition  
**Status:** Pre-development concept  
**Final Product Name:** To be determined

---

# 1. Executive Summary

We are developing a modern, intelligent, and continuously updated online platform dedicated to discovering subscription discounts, promotional codes, student benefits, free trials, lifetime software deals, and special offers from companies around the world.

The platform will combine curated deal discovery, automated offer monitoring, country-specific eligibility, student discount directories, and historical promotional analysis.

Rather than acting as a traditional coupon directory, it will help users answer:

1. What offers are available right now?
2. Which discounts can I actually claim?
3. Which offer provides the best real value?
4. What happens when the promotional period expires?
5. Is there a better time to purchase this service?

The application must be a functioning web product with a real backend, database, administrative interface, scheduled background monitoring, and trustworthy offer data.

It must not be built as a static showcase or a frontend-only demonstration.

## Core Product Philosophy

**Find the right deal. Know whether you qualify. Understand the real cost.**

Accuracy, trust, clarity, and usability must take priority over the number of deals displayed.

---

# 2. Problem Statement

People frequently pay full prices for subscriptions without knowing that relevant discounts, coupons, student offers, or promotional credits exist.

Offers are scattered across official company websites, newsletters, software marketplaces, student platforms, affiliate programs, promotional campaigns, and online communities.

Existing coupon platforms have several common shortcomings:

- Expired or invalid coupon codes remain visible.
- Regional restrictions are difficult to identify.
- Student eligibility requirements are poorly explained.
- Coupons are displayed without their exact redemption conditions.
- Promotional prices are emphasized while renewal prices receive little attention.
- Different sources list the same deal repeatedly.
- Users cannot easily identify recurring promotional periods.
- Generic discount directories mix software offers with unrelated shopping coupons.
- A listed offer is sometimes described as verified without sufficient evidence.

The proposed platform will address these problems through centralized discovery, structured offer information, transparent verification, intelligent filtering, and historical tracking.

---

# 3. Target Audience

## Primary Audiences

**Students**

University and college students seeking affordable software, AI tools, learning resources, cloud credits, entertainment subscriptions, and educational benefits.

**Freelancers and Creative Professionals**

Graphic designers, video editors, developers, marketers, writers, and independent professionals who rely on multiple paid applications.

**Developers and AI Enthusiasts**

People interested in AI subscriptions, developer platforms, API credits, cloud hosting, coding assistants, productivity tools, and automation services.

**Startup Founders and Small Teams**

Businesses looking to reduce recurring software expenses and discover lifetime deals or new software alternatives.

## Secondary Audiences

- Educators
- Researchers
- Content creators
- Agencies
- Remote workers
- General subscription customers
- Deal enthusiasts

The interface should accommodate both users who know exactly what service they need and users who simply want to discover useful offers.

---

# 4. Unique Value Proposition

The platform will differentiate itself through five core capabilities.

## 4.1 Country-Aware Discovery

Users can choose their country and browse relevant offers without repeatedly checking whether they qualify.

## 4.2 Transparent Verification

Every offer displays its current verification state, last checked timestamp, known restrictions, and supporting source.

## 4.3 Subscription-Specific Information

Deals include billing periods, trial durations, renewal costs, cancellation requirements, and available subscription tiers.

## 4.4 Historical Offer Intelligence

Users can explore previous promotional periods and identify when specific companies have historically offered discounts.

## 4.5 Personalized Discovery

Users can follow companies, save offers, and receive relevant notifications when new or improved discounts appear.

---

# 5. Information Architecture

The platform will use a clear, consistent navigation system.

## Primary Navigation

- Home
- Explore Deals
- Student Offers
- Coupons
- Free Trials
- Lifetime Deals
- Deals Calendar
- Companies
- Saved Deals (when authenticated)

## Product Categories

### AI & Machine Learning
AI assistants, image generation, video generation, voice AI, AI coding agents, research tools, model APIs, and automation services.

### Design & Creative
Graphic design, UI/UX tools, illustration, photography, prototyping, animation, creative assets, fonts, and design resources.

### Video & Audio
Video editing, motion graphics, sound production, music software, stock media, and post-production tools.

### Hosting & Domains
Web hosting, domains, managed hosting, cloud infrastructure, storage, CDN services, and deployment platforms.

### Development & Coding
IDEs, developer tools, Git services, databases, APIs, testing tools, security tools, and coding courses.

### Productivity & Collaboration
Project management, document software, note-taking, communication, scheduling, automation, and team management.

### Marketing & Business
SEO, CRM, email marketing, sales automation, analytics, social media management, and agency software.

### Education & Learning
Learning platforms, courses, research resources, student tools, and professional certifications.

### Entertainment
Streaming, music, gaming subscriptions, reading platforms, and digital entertainment services.

### Security & Privacy
VPNs, password managers, encrypted storage, backup tools, and cybersecurity software.

A company may belong to multiple categories. Categories should be data-driven rather than hardcoded into individual pages.

Promotion types such as student discounts, free trials, lifetime deals, and coupons should be treated as cross-category filters and discovery destinations, not mutually exclusive product categories.

---

# 6. Homepage Experience

The homepage must communicate the platform's purpose immediately.

## 6.1 Header

Include:

- Platform logo
- Clear category navigation
- Prominent search functionality
- Country selector
- Saved deals access
- User account access
- Theme preference, if included in the final design system

Navigation must remain usable on desktop, tablet, and mobile.

Avoid overcrowding the header with every available category.

## 6.2 Hero Section

The hero must communicate the central benefit in simple language.

Suggested headline:

**Find better deals on the software you actually use.**

Suggested supporting text:

Discover software discounts, student offers, promo codes, and lifetime deals. Check eligibility, compare real costs, and track upcoming promotions.

Include a prominent search field and a secondary route to explore categories.

## 6.3 Featured Homepage Sections

- Recently Verified Deals
- New This Week
- Popular AI Deals
- Student Discounts
- Creative Software Deals
- Free Trials and Promotional Credits
- Lifetime Deals
- Expiring Soon
- Upcoming Sales
- Trending Companies

Do not display every section if insufficient relevant data exists.

Section visibility and ordering should be configurable through the administrative dashboard.

## 6.4 Homepage Design Priorities

The homepage should not become an endless wall of coupon cards.

Use clear grouping, descriptive headings, appropriate spacing, and sensible card limits.

Allow users to explore full category pages when they want more options.

Sponsored deals must be labeled and should not automatically outrank more relevant verified offers.

---

# 7. Deal Card System

Deal cards are the platform's most important repeated interface component.

Each card should communicate the deal's essential information without requiring the user to open the detail page.

## Essential Card Elements

1. Company logo
2. Company or product name
3. Short promotional headline
4. Primary discount or benefit
5. Promotional price when known
6. Applicable country or region
7. Eligibility type
8. Verification status
9. Expiration date when confirmed
10. Appropriate action button

## Optional Card Elements

- Original price
- Plan name
- Renewal pricing indication
- Student verification requirement
- Offer type
- Source or marketplace
- Date last checked
- Save/bookmark control
- Limited-time indicator

## Information Hierarchy

The discount or primary benefit should be visually dominant.

The product name should be immediately recognizable.

Eligibility and geographic restrictions must be discoverable before the user clicks Claim.

Less important details can appear on the expanded detail page.

Avoid filling cards with excessive labels.

## Deal Card Variants

**Coupon Card:** A promotional code is available.

**Direct Deal Card:** The promotion is activated by following a direct link.

**Student Offer Card:** Student verification or educational eligibility is required.

**Free Trial Card:** A promotional trial or temporary free subscription is available.

**Lifetime Deal Card:** A one-time purchase grants access under specific vendor terms.

**Promotional Credit Card:** A service provides temporary or conditional credits.

**Expired Deal Card:** A previously recorded promotion is no longer confirmed as available.

Every variant must use a consistent core component system.

---

# 8. Deal Actions and Redemption

## 8.1 Coupon Codes

Primary button: **Reveal Code**

On activation:

- Reveal the available coupon.
- Provide a one-click copy action.
- Show relevant restrictions.
- Provide a Visit Website action.
- Allow the user to report whether the code worked.

The code should be accessible without forcing users to create an account, subscribe to a newsletter, or complete unnecessary steps.

## 8.2 Direct-Link Promotions

Primary button: **Claim Deal**

The action should open the official destination or authorized promotional partner page.

Clearly distinguish partner or affiliate links when applicable.

## 8.3 Student Offers

Primary button should reflect the actual action, such as:

- Claim Student Offer
- Verify Eligibility
- View Student Discount

Include necessary verification instructions before sending the user elsewhere.

## 8.4 Unavailable or Unverified Offers

Expired offers should be clearly labeled.

Unverified offers may remain visible where useful, but their status must be unambiguous.

Never display a confidently worded "Verified Working" label without appropriate evidence.

---

# 9. Search and Filtering

Search should be one of the primary interaction methods.

## 9.1 Global Search

Users must be able to search for:

- Company names
- Product names
- Software categories
- Coupon codes or deal types
- Specific offers
- Related keywords

Support typo tolerance, useful autocomplete, and relevant suggestions.

## 9.2 Filters

Include filters for:

- Country
- Category
- Company
- Deal type
- Student eligibility
- Discount percentage
- Price range
- Billing period
- Lifetime versus subscription
- Free versus paid
- New versus existing customers
- Verification status
- Expiration date
- Platform or operating system where relevant

## 9.3 Sorting

Include:

- Most Relevant
- Newly Added
- Recently Verified
- Highest Discount
- Lowest Promotional Price
- Expiring Soon

Do not use misleading ranking logic or fabricated urgency.

## 9.4 Filter Interaction

On desktop, use a visible filter sidebar or a clearly discoverable filter panel.

On mobile, use a dedicated filter drawer with an explicit Apply action.

Always show selected filters above results as removable chips.

Provide Clear All and preserve filter state when navigating back from a deal page.

Users should be able to select multiple values within a relevant filter group.

## 9.5 Empty States

When no eligible offers match the selected criteria:

- Explain why no results are displayed.
- Provide a simple way to remove restrictive filters.
- Suggest related categories.
- Offer to track the company for future promotions.

Never fabricate offers to fill empty result pages.

---

# 10. Country and Eligibility System

Geographic eligibility must be treated as first-class product data.

## Country Selection

Allow users to select their country manually.

A lightweight suggestion based on approximate location may be offered, but the user must remain in control.

Remember the selected country where permitted.

## Eligibility States

- Confirmed eligible
- Confirmed ineligible
- Likely eligible, pending verification
- Eligibility unknown

Do not assume that an offer is global simply because its page is accessible worldwide.

## Country-Aware UX

When a user selects Bangladesh, for example, the interface should prioritize confirmed Bangladesh-eligible or global offers.

Offers restricted to other countries can remain discoverable through a clearly labeled option.

If regional eligibility cannot be confirmed, show "Country eligibility not confirmed" rather than hiding uncertainty.

## Other Eligibility Conditions

Track:

- Student status
- Institution eligibility
- New-customer-only rules
- Existing-subscriber rules
- Payment method restrictions
- Mobile-app versus website billing
- Referral requirements
- Minimum spending
- Coupon stacking limitations
- Limited redemption counts
- Individual versus business plans

The system must not confuse eligibility with the technical availability of a promotional page.

---

# 11. Student Offers Directory

Create a dedicated Student Offers experience, accessible from the main navigation.

## Student Landing Page

Include:

- Popular student benefits
- Free student software
- AI subscriptions
- Creative software
- Developer benefits
- Cloud credits
- Educational resources
- Entertainment subscriptions

## Student Offer Details

Each offer should include:

- Educational eligibility requirements
- Supported countries
- Required verification provider
- Student email requirements
- Eligible institution types
- Promotional duration
- Maximum eligible duration, if specified
- First-time versus existing-customer rules
- Renewal pricing
- Verification renewal requirements
- Official redemption link

Examples of possible verification methods include student email verification, university single sign-on, SheerID, UNiDAYS, or other authorized services.

The platform must not collect university passwords or impersonate verification providers.

## Student Onboarding

Optional users may set their student status and country in their profile.

Institution information should only be requested if necessary and should not be used to falsely certify eligibility.

---

# 12. Individual Company Pages

Create a dedicated, search-engine-friendly page for each company or service.

## Company Page Content

- Company name and logo
- Short product description
- Product categories
- Official website
- Available promotions
- Active coupons
- Student offers
- Trial offers
- Lifetime deals, if available
- Known pricing details
- Offer history
- Known restrictions
- Related alternatives
- Option to follow the company

One company may have several simultaneously active promotions.

## Best Available Offer

Where sufficient verified data exists, display the most attractive currently eligible offer.

Recommendations must consider the user's country, plan type, eligibility, actual price, and relevant restrictions.

Do not rank offers purely by advertised discount percentage.

For offers that cannot be meaningfully compared, present a neutral list instead of declaring a winner.

---

# 13. Pricing Transparency

Subscription discounts can be misleading when promotional and renewal prices differ.

Every relevant offer detail page should show:

- Normal subscription price
- Promotional subscription price
- Promotional duration
- Billing currency
- Billing frequency
- Payment required upfront
- Renewal price
- Automatic renewal status
- Cancellation requirements
- Taxes, if known
- Required payment method, if disclosed
- Whether the offer applies to an existing account

If a price is not reliably available, label it as unavailable rather than guessing.

## Pricing Comparison

Allow users to understand the total cost over a comparable period.

For example:

- Cost during the first month
- Cost during the first year
- Expected renewal cost
- Total cost over 12 months, where terms permit calculation

Only calculate savings when the standard reference price is trustworthy and the same plan and billing assumptions are being compared.

Clearly separate temporary promotional savings from permanent discounted pricing.

---

# 14. Automated Discovery and Collection

The backend must continuously maintain an up-to-date catalog of software promotions.

"Continuously" refers to a reliable scheduled monitoring system, not unrestricted nonstop scraping of every website.

## Source Categories

Potential information sources include:

1. Official promotional pages
2. Official company pricing pages
3. Public student discount pages
4. Authorized partner feeds and APIs
5. Affiliate programs that permit deal data use
6. Public company announcements
7. Company newsletters with appropriate authorization
8. Community-submitted deals
9. Permitted public marketplace listings
10. Curated editorial submissions

Social media posts, community discussions, and third-party coupon sites can act as discovery signals.

Whenever possible, verify the underlying promotion using the company or another authoritative source.

## Source Connector Architecture

Each supported source must use an independent connector.

A connector should contain:

- Source identification
- Permitted retrieval method
- Authentication configuration where required
- Fetch scheduling
- Rate limits
- Parsing and extraction logic
- Normalization rules
- Error handling
- Provenance metadata
- Last successful check timestamp

The platform must not assume every website can be scraped automatically.

## Responsible Collection

Respect applicable terms, access restrictions, robots directives, rate limits, and relevant laws.

Do not bypass login requirements, CAPTCHAs, anti-bot systems, or access controls.

Do not copy full third-party articles, reviews, images, or proprietary databases without appropriate rights.

Prefer official sources, authorized integrations, and original deal summaries.

---

# 15. Automated Offer Monitoring

Implement background jobs that regularly revisit known offers.

The monitoring system should detect:

- Newly available promotions
- Price changes
- Coupon changes
- Announced expiration dates
- Removed promotional pages
- Modified eligibility conditions
- Changes in redemption links
- Previously expired promotions becoming available again
- Duplicate offers
- Source failures

## Verification Scheduling

Use risk-based and source-specific refresh schedules.

High-priority or soon-expiring offers may require more frequent monitoring.

Evergreen educational discounts may require less frequent checks.

Monitoring frequencies should be configurable rather than universally fixed.

## Failed Checks

A network timeout or inaccessible page should not automatically make an offer expired.

Record the failure, retry where appropriate, and reduce confidence when evidence becomes stale.

Repeated failures should trigger an administrative review.

---

# 16. Verification and Trust System

The platform must distinguish several independent concepts.

## Publication Status

- Draft
- Pending Review
- Published
- Archived

## Offer Availability

- Active
- Expired
- Paused
- Unknown

## Verification State

- Officially Confirmed
- Redemption Tested
- Evidence Supported
- Unverified
- Verification Stale

## Eligibility

- Eligible
- Ineligible
- Unknown
- Requires Verification

These states must not be collapsed into one misleading "Verified" badge.

A promotional page being online does not mean its coupon works.

A coupon working for one person does not prove it works in every country.

## Verification Evidence

Store:

- Source URL
- Source type
- Discovery timestamp
- Last checked timestamp
- Verification method
- Official terms
- Observed changes
- Verification evidence
- Confidence metadata
- Known limitations

Automated redemption testing may be performed only when authorized and technically appropriate.

Human verification and user feedback should complement automated checks.

## User Reports

Allow visitors to report:

- Coupon does not work
- Promotion expired
- Wrong discount amount
- Country unavailable
- Student verification failed
- Broken link
- Incorrect renewal information

Reports should trigger review, not immediately change the displayed status based on one anonymous submission.

Add abuse prevention to avoid manipulated success rates or malicious reports.

---

# 17. Duplicate Detection

The same promotion may appear on multiple websites.

The platform should identify duplicate or equivalent offers using:

- Company identity
- Product identity
- Subscription tier
- Promotional code
- Redemption destination
- Discount details
- Eligibility restrictions
- Promotional date range

Merge equivalent offers into a canonical deal record.

Preserve source references and original observations.

Different offers for the same company must remain separate if they have meaningfully different eligibility rules or redemption paths.

---

# 18. Deals Calendar and Historical Promotions

This section is a major differentiating feature.

Create an interactive calendar showing previous, ongoing, and upcoming promotional activity.

## Calendar Views

- Monthly calendar
- Upcoming offers
- Historical promotions
- Company-specific timelines
- Seasonal promotional periods

## Event Classification

**Confirmed:** An upcoming promotion officially announced by the company.

**Historical:** A promotion previously observed and recorded with supporting evidence.

**Predicted:** A potential promotional window inferred from historical observations.

Never present predicted dates as confirmed sale dates.

## Recurring Promotions

Track occasions such as:

- Black Friday
- Cyber Monday
- Back-to-school campaigns
- New Year promotions
- Company anniversary campaigns
- Seasonal software promotions
- Periodic product launches
- Special student registration periods

For each company, record how often promotions have historically occurred.

## Monthly Offer Patterns

Provide a feature that answers:

"When has this company offered discounts during previous months or years?"

Show recorded dates and supporting sources.

If a recurring pattern is detected, it can inform a predicted window, but should not imply certainty.

## Calendar Interactions

Users should be able to:

- Filter events by company
- Filter by category
- View past promotional history
- See confirmed upcoming campaigns
- Save events
- Follow companies
- Request notifications

Predictions should be withheld if insufficient historical evidence exists.

---

# 19. Deal History and Price Tracking

Store meaningful changes in offers over time.

## Historical Data

- Previously advertised prices
- Previous discount percentages
- Promotion start dates
- Promotion end dates
- Eligibility conditions
- Price changes
- Redemption changes
- Historical source references

## User-Facing Features

Where sufficient data exists, show:

- Historical promotion timeline
- Previous lowest observed price
- Most recent promotional price
- Frequency of observed promotions
- Price movement chart

Clearly indicate the observation period and gaps in tracking.

Never advertise an all-time lowest price unless the platform has reliable evidence supporting that claim.

---

# 20. Saved Deals, Watchlists, and Notifications

Browsing should work without registration.

Optional accounts can offer additional functionality.

## User Features

- Save favorite deals
- Follow companies
- Follow categories
- Select preferred countries
- Track student discounts
- Request price-drop notifications
- Receive promotional calendar reminders
- Manage email preferences

## Notification Types

- New verified offer
- New student promotion
- Company launched a new deal
- Price dropped below a selected threshold
- Saved offer is expiring
- Confirmed promotion begins
- Previously expired offer returns

Avoid frequent duplicate notifications.

Provide clear notification settings and unsubscribe options.

Do not send alerts based solely on uncertain predictions without clearly communicating their status.

---

# 21. Deal Submission and Community Participation

Allow users to submit promotions that are missing from the database.

## Submission Information

- Company or product
- Official offer link
- Coupon code, if applicable
- Advertised benefit
- Country restrictions
- Expiration date, if known
- Supporting evidence
- Optional notes

Submissions must enter a review workflow.

Do not immediately publish unverified community submissions as confirmed deals.

Consider a future system where trusted contributors can earn reputation based on the accuracy of their submissions.

This is optional and should not complicate the initial MVP.

---

# 22. Administrative Dashboard

Develop a secure dashboard for operating the entire platform.

## Deal Management

Administrators can:

- Create offers
- Edit offers
- Approve offers
- Reject offers
- Archive offers
- Correct eligibility
- Correct pricing
- Manage coupon codes
- Set expiration dates
- Review supporting sources

## Source Management

Administrators can:

- View source connectors
- Inspect last successful checks
- Configure monitoring frequencies
- Review extraction failures
- Pause individual connectors
- Review source permission status
- Detect suspicious data changes

## Verification Management

Provide:

- Verification queue
- Stale deals list
- Expiring offers list
- User report queue
- Conflicting-source alerts
- Broken-link reports
- Verification history

## Content Management

Manage:

- Companies
- Categories
- Homepage features
- Promotional calendar events
- Editorial explanations
- Source attributions

## Analytics

Track:

- Visitors and searches
- Popular categories
- Offer detail views
- Claim and reveal interactions
- User reports
- Search results with no matches
- Deal freshness
- Verification success
- Background job health

Do not equate a Claim button click with a completed purchase.

---

# 23. Detailed UX and Interaction Requirements

## Design Principles

**Clarity over decoration**

Beautiful visuals must not obscure important pricing or eligibility information.

**Progressive disclosure**

Cards should show the essentials. Detailed terms should remain accessible on product pages.

**Consistency**

Use common layouts, interaction patterns, and terminology across categories.

**Visible system status**

Users should know whether an action succeeded, a code was copied, or an offer is being rechecked.

**Accessible interactions**

The experience should support keyboards, screen readers, visible focus indicators, and reduced-motion preferences.

**Avoid deceptive patterns**

No fake countdowns, fabricated discount percentages, misleading badges, or forced signups to reveal public codes.

## Mobile UX

The mobile experience must be designed intentionally rather than created by simply shrinking desktop layouts.

Consider:

- Search access
- Compact navigation
- Easily accessible country selector
- Filter drawer
- Readable offer cards
- Touch-friendly action buttons
- Minimal modal interruptions
- Clear coupon-copy feedback

## Loading and Error States

Design:

- Loading skeletons
- Empty search results
- Unsupported country states
- Temporarily unavailable sources
- Broken redemption links
- Failed copy actions
- Unverified deal warnings
- Expired offer alternatives

Every state must have a useful explanation and appropriate next action.

---

# 24. Design Reference PDF Integration

A separate PDF containing visual design references will be supplied before or during development.

This PDF is a primary input for visual design direction.

## Instructions for the Development Agent

1. Inspect the complete PDF before creating the production UI.
2. Review each visual reference individually.
3. Identify the layout structure, typography, spacing, color system, components, navigation, and interaction patterns.
4. Map reference pages or screenshots to the planned website routes and components.
5. Identify which references describe global styles and which describe specific pages.
6. Extract a coherent, reusable design system.
7. Build visual components that closely reflect the supplied direction.
8. Adapt the design where necessary to improve usability, accessibility, and responsiveness.
9. Document material departures from the provided visual references.
10. Validate the finished UI against the references using screenshots and visual review.

## Visual Fidelity Expectations

The final interface should resemble the intended structure and style of the provided references as closely as practical.

However, the PDF is a design reference rather than permission to reproduce another company's proprietary branding, assets, or copyrighted content.

Prefer faithful implementation of the visual language using original assets, original content, and the product's own identity.

Do not use visual resemblance as a reason to sacrifice readability, functionality, or accessibility.

## Design Decision Hierarchy

1. Core product functionality and truthful information
2. Accessibility and usability
3. Explicit design requirements in the provided PDF
4. Overall visual consistency
5. Additional decorative effects

If a reference is ambiguous, preserve the broader design direction rather than inventing unrelated visual patterns.

If multiple references conflict, document the conflict and choose the solution that best fits the specified product experience.

---

# 25. Technical Architecture

Build a maintainable application with a real database and backend.

## Suggested Stack

**Frontend:** Next.js, TypeScript, Tailwind CSS

**UI Components:** shadcn/ui with carefully selected additional components where helpful

**Database:** PostgreSQL

**Authentication:** A suitable managed authentication provider

**Backend:** Server-side APIs and application services

**Background Processing:** Scheduled jobs and a durable task queue

**Discovery:** Modular permitted-source connectors

**Data Processing:** Validation, normalization, deduplication, and verification services

**Search:** Database-backed search initially, with a dedicated search service only if necessary

**Hosting:** A production hosting provider capable of supporting the frontend and required background infrastructure

The development agent should evaluate trade-offs before selecting exact providers.

Avoid unnecessary microservices or expensive infrastructure for the MVP.

## Architecture Boundaries

Separate:

- Presentation and interaction components
- Offer business logic
- Source retrieval connectors
- Verification logic
- Database access
- Scheduled jobs
- Administrative functions
- User notification services

The frontend must not independently decide whether an offer is verified.

Verification and eligibility logic should be centrally maintained and testable.

---

# 26. Proposed Database Entities

At minimum, model:

- Users
- User Preferences
- Companies
- Products
- Subscription Plans
- Categories
- Offers
- Coupons
- Offer Eligibility Rules
- Countries and Regions
- Verification Records
- Source Records
- Source Observations
- Historical Prices
- Promotional Events
- Saved Deals
- Company Watchlists
- User Reports
- Notification Subscriptions
- Monitoring Jobs
- Administrative Audit Logs

Represent company, product, plan, offer, and coupon as distinct concepts.

A single company can have multiple products.

A product can have multiple plans.

A plan can have multiple offers.

An offer can have multiple source records and regional eligibility rules.

Historical observations should remain available for auditing and future trend analysis.

---

# 27. Core Backend Data Pipeline

The general lifecycle should be:

**Discover → Retrieve → Parse → Normalize → Validate → Deduplicate → Verify → Review → Publish → Monitor → Update or Archive**

## Discovery

Find candidate promotions from authorized sources.

## Retrieval

Fetch permitted source data and record provenance.

## Parsing

Extract dates, pricing, codes, links, restrictions, and product information.

## Normalization

Convert extracted information into a consistent internal data format.

## Validation

Check required fields, structured types, prices, dates, and URLs.

## Deduplication

Identify existing equivalent deals.

## Verification

Assess official evidence, known restrictions, and permitted redemption checks.

## Review

Route uncertain or potentially conflicting records through administrative approval.

## Publication

Display an accurate offer with its appropriate status.

## Monitoring

Recheck published offers based on configurable schedules.

## Archiving

Move expired or retired promotions into historical records without destroying useful evidence.

AI may assist in extracting and classifying information, but it must not invent missing prices, coupon codes, dates, or eligibility conditions.

---

# 28. Security and Privacy

Implement:

- Secure authentication
- Server-side authorization
- Role-based administration
- Secrets management
- Input validation
- Safe external redirects
- Protection from malicious scraped content
- Request rate limiting
- Job execution limits
- Audit logs
- Database backups
- Privacy-conscious analytics

Do not store payment information unless a future business requirement explicitly justifies it.

The initial product should redirect users to approved merchants rather than collect purchases directly.

Do not collect student identification documents or credentials to verify eligibility on behalf of third-party services.

---

# 29. SEO and Discoverability

Implement:

- Search-friendly category pages
- Dedicated company pages
- Descriptive offer URLs
- Unique useful content
- Proper headings and metadata
- Canonical URLs
- XML sitemap
- Appropriate structured data where eligible
- Fast server-rendered public pages
- Internal linking between companies and categories
- Clear handling of expired offers

Avoid producing hundreds of nearly identical low-value pages from scraped content.

Expired promotional pages can remain accessible when they provide genuine historical value.

Do not mark the platform as a direct product seller when it only redirects visitors to third-party merchants.

---

# 30. Monetization Strategy

The initial browsing experience should remain free.

Potential future revenue sources include:

- Disclosed affiliate commissions
- Clearly labeled sponsored offers
- Promotional partnerships
- Premium deal notifications
- Advanced price tracking
- Optional business-focused research tools

Monetization must not undermine offer rankings or verification standards.

Affiliate relationships should be disclosed.

Sponsored listings should never be presented as independently verified editorial recommendations solely because payment was received.

---

# 31. MVP Definition

The first release should prove that the platform can reliably discover, organize, and maintain useful deals.

## MVP Features

- Responsive homepage
- Clear navigation
- Core software categories
- Search and filters
- Country selector
- Deal cards
- Offer detail pages
- Student offers
- Coupon reveal and copy
- Direct claim links
- Real database
- Administrative dashboard
- Manual deal entry
- Small number of authorized source connectors
- Scheduled monitoring
- Verification timestamps
- Expired-deal handling
- Basic historical offer records
- Initial Deals Calendar

## MVP Launch Content

Begin with approximately 30–50 carefully researched offers across a limited set of high-demand software categories.

Only publish verified or transparently labeled offers.

Coverage should be intentionally limited during the initial release.

Prioritize data accuracy over an impressive-looking number of listings.

## Deferred Features

- Advanced user reputation
- Browser extension
- AI-powered shopping assistant
- Personalized machine-learning recommendations
- Automated checkout testing at scale
- Native mobile applications
- Advanced predictive deal models
- Complex enterprise analytics
- Public developer API

These can be evaluated after real users validate the initial product.

---

# 32. Success Metrics

Measure product success through:

## Trust and Accuracy

- Percentage of published offers with current evidence
- Percentage of stale offers
- Confirmed invalid-code rate
- Average time to correct reported problems
- Percentage of offers with complete eligibility information

## Discovery Experience

- Successful search rate
- Searches with no relevant results
- Time required to find an eligible deal
- Filter usage
- Mobile interaction completion
- Offer detail engagement

## User Value

- Returning visitors
- Saved offers
- Company follows
- Notification usefulness
- User-confirmed successful redemptions
- Satisfaction with pricing and restriction transparency

## Technical Reliability

- Background job completion rate
- Source connector failures
- Database availability
- Page load performance
- API errors
- Test coverage
- Accessibility regressions

Clicks on affiliate links should not be the only measure of success.

---

# 33. User Testing and Validation

Before a public launch, conduct usability testing with students, freelancers, developers, and subscription buyers.

Test whether users can:

1. Find a discount for a known service.
2. Determine whether the offer works in their country.
3. Understand student eligibility.
4. Reveal and copy a coupon.
5. Identify renewal costs.
6. Distinguish confirmed offers from unverified listings.
7. Find previously observed promotional periods.
8. Track a desired future offer.

Pay particular attention to the usability of mobile filters and the readability of pricing terms.

Use testing results to improve the interface before expanding the number of sources.

---

# 34. Non-Goals and Product Boundaries

The initial platform is not:

- A payment-processing marketplace
- A subscription reseller
- A student identity verification provider
- A guarantee that all public coupons will work
- An unauthorized scraper of private platforms
- A complete historical pricing database from day one
- A website that fabricates sale predictions
- A replacement for official merchant terms

Avoid attempting to implement every possible category or integration in the first release.

---

# 35. Development Documentation

This master brief should act as the source of truth for product intent.

Before implementation, prepare:

**CLAUDE.md**  
Short, project-specific development instructions, repository conventions, architectural invariants, and exact test/build commands.

**docs/PRODUCT.md**  
Product vision, target users, functionality, requirements, and roadmap derived from this brief.

**docs/UX.md**  
Information architecture, user journeys, interaction rules, accessibility, and responsive design requirements.

**docs/DESIGN_SYSTEM.md**  
Typography, colors, spacing, components, variants, responsive rules, and decisions derived from the design-reference PDF.

**docs/ARCHITECTURE.md**  
Application architecture, service boundaries, infrastructure choices, and important engineering decisions.

**docs/DATA_MODEL.md**  
Database entities, relationships, validation rules, and data provenance requirements.

**docs/SOURCES.md**  
Approved data sources, integration methods, permissions, refresh schedules, and known limitations.

**docs/VERIFICATION.md**  
Offer status definitions, evidence requirements, monitoring policies, and publication rules.

**docs/PLAN.md**  
Prioritized implementation phases, dependencies, and acceptance criteria.

**docs/PROGRESS.md**  
Completed work, active tasks, test results, blockers, and exact resume instructions.

Keep CLAUDE.md concise rather than duplicating the entire product specification.

---

# 36. Implementation Roadmap

## Phase 1: Product Foundation

Define product architecture, database schema, information architecture, design system, routing, and core components.

## Phase 2: Discovery Frontend

Implement homepage, categories, search, filters, deal cards, company pages, coupon interactions, and responsive behavior.

## Phase 3: Backend Foundation

Implement persistent data storage, API services, administrative management, and offer lifecycle logic.

## Phase 4: Automated Discovery

Build the first authorized source connectors, ingestion pipeline, deduplication, scheduled jobs, and verification workflows.

## Phase 5: Historical Intelligence

Implement offer observations, historical timelines, promotional calendar, and evidence-based sale patterns.

## Phase 6: Personalization

Add optional accounts, saved offers, company watchlists, and notifications.

## Phase 7: Production Hardening

Complete functional testing, security review, accessibility testing, responsive verification, performance optimization, and deployment monitoring.

Each phase must be independently testable.

Do not mark a phase completed without successfully validating its stated acceptance criteria.

---

# 37. Final Product Experience

A visitor should be able to open the platform, select a country, find a subscription service, understand the available discounts, identify the conditions for claiming an offer, review the true cost, and proceed to an appropriate redemption page without confusion.

If no suitable promotion is currently available, the platform should still be useful by displaying historical promotional information, alternatives, and optional future notifications.

The product should feel curated, fast, trustworthy, visually polished, and intentionally designed.

The long-term goal is to create a reliable global destination for finding, understanding, and tracking software subscription offers.

**Final product principle:**

A smaller collection of trustworthy, understandable deals is more valuable than a massive collection of questionable coupon codes.