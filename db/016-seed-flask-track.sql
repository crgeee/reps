-- Seed Flask learning track

INSERT INTO tracks (id, slug, title, description) VALUES
  ('499c7806-4197-4df6-8e7a-172acaad381f', 'flask', 'Flask', 'Learn Flask by building — routes, templates, databases, APIs, and deployment.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO modules (id, track_id, slug, title, description, sort_order, concepts) VALUES
  ('23917f1a-d096-4566-9ffa-c9a818b52e16', '499c7806-4197-4df6-8e7a-172acaad381f', 'hello-flask',  'Hello Flask',    'Create your first Flask app, run the dev server, understand the request-response cycle.', 1,  ARRAY['Flask', 'app factory', 'development server', 'WSGI', 'request-response cycle']),
  ('f74854fc-88d2-42c2-b9fa-d7a8fe8b21dd', '499c7806-4197-4df6-8e7a-172acaad381f', 'routing',      'Routing',        'URL rules, dynamic segments, HTTP methods, URL building with url_for.', 2,  ARRAY['@app.route', 'URL parameters', 'converters', 'HTTP methods', 'url_for']),
  ('b50ab13a-a4a5-46ba-b530-889ee4c6888f', '499c7806-4197-4df6-8e7a-172acaad381f', 'templates',    'Templates',      'Jinja2 templating, template inheritance, filters, and macros.', 3,  ARRAY['Jinja2', 'render_template', 'template inheritance', 'filters', 'macros', 'autoescape']),
  ('6c193324-940f-4a41-be1a-8c9fbaeb1af9', '499c7806-4197-4df6-8e7a-172acaad381f', 'forms-input',  'Forms & Input',  'Handle form submissions, access request data, validate user input.', 4,  ARRAY['request.form', 'request.args', 'request.json', 'file uploads', 'flash messages']),
  ('16ae8c80-e713-45c5-a7eb-18557b3c5506', '499c7806-4197-4df6-8e7a-172acaad381f', 'database',     'Database',       'SQLAlchemy basics, define models, perform CRUD operations, run migrations.', 5,  ARRAY['Flask-SQLAlchemy', 'db.Model', 'db.session', 'CRUD', 'relationships', 'Flask-Migrate']),
  ('d2db4b55-436a-49d0-af20-0761d1f48310', '499c7806-4197-4df6-8e7a-172acaad381f', 'auth',         'Authentication', 'User sessions, login/logout, password hashing, login_required decorator.', 6,  ARRAY['Flask-Login', 'sessions', 'werkzeug.security', 'login_required', 'current_user']),
  ('3f78c323-f967-4e58-9dbc-6148293a6810', '499c7806-4197-4df6-8e7a-172acaad381f', 'rest-apis',    'REST APIs',      'Build JSON APIs, handle request parsing, error responses, and status codes.', 7,  ARRAY['jsonify', 'request.get_json', 'abort', 'error handlers', 'HTTP status codes']),
  ('fead7162-fdeb-49af-9b5c-87c233e00887', '499c7806-4197-4df6-8e7a-172acaad381f', 'blueprints',   'Blueprints',     'Organize large apps with blueprints, register URL prefixes, share templates.', 8,  ARRAY['Blueprint', 'register_blueprint', 'url_prefix', 'blueprint templates', 'app factory pattern']),
  ('a208b5cf-3a34-4a98-baf4-bc7c67ef6673', '499c7806-4197-4df6-8e7a-172acaad381f', 'testing',      'Testing',        'Write tests with pytest, use the test client, fixtures, and test configuration.', 9,  ARRAY['pytest', 'app.test_client', 'fixtures', 'test config', 'coverage']),
  ('c93358b8-1ce6-4911-a1e5-e54bfc7a2600', '499c7806-4197-4df6-8e7a-172acaad381f', 'deployment',   'Deployment',     'Production setup with Gunicorn, environment config, logging, and common patterns.', 10, ARRAY['gunicorn', 'config classes', 'environment variables', 'logging', 'error pages'])
ON CONFLICT DO NOTHING;

INSERT INTO settings (key, value) VALUES
  ('learn.executionTimeoutSeconds', '30'),
  ('learn.executionMemoryMb', '128'),
  ('learn.maxConcurrent', '1'),
  ('learn.circuitBreakerThreshold', '5'),
  ('learn.circuitBreakerCooldownMin', '5'),
  ('learn.featureEnabled', 'true')
ON CONFLICT (key) DO NOTHING;
