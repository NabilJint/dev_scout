-- DevScout AI tool_sources seed data
-- Sources for discovering new developer tools
insert into public.tool_sources (name, listing_url, logo_url, active, parser_strategy)
values
    ('Product Hunt', 'https://producthunt.com', 'https://bookface-images.s3.amazonaws.com/logos/97f0c3ad2f9e359b740502c375a9588fc5d42306.png', true, 'producthunt'),
    ('Hacker News', 'https://news.ycombinator.com', 'https://news.ycombinator.com/favicon.ico', true, 'hackernews'),
    ('GitHub Trending', 'https://github.com/trending', 'https://github.githubassets.com/favicons/favicon.svg', true, 'github-trending'),
    ('BetaList', 'https://betalist.com', 'https://betalist.com/favicon.ico', true, 'betalist'),
    ('SaaSHub', 'https://saashub.com', 'https://saashub.com/favicon.ico', true, 'saashub'),
    ('Dev.to', 'https://dev.to', 'https://dev.to/favicon.ico', true, 'devto'),
    ('Reddit r/SideProject', 'https://reddit.com/r/SideProject', 'https://reddit.com/favicon.ico', true, 'reddit')
on conflict (listing_url) do nothing;
