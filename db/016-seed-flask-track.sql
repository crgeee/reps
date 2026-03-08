-- Seed Flask learning track

INSERT INTO tracks (id, slug, title, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'flask', 'Flask', 'Learn Flask by building — routes, templates, databases, APIs, and deployment.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO modules (id, track_id, slug, title, description, sort_order, concepts) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'hello-flask',  'Hello Flask',    'Create your first Flask app, run the dev server, understand the request-response cycle.', 1,  ARRAY['Flask', 'app factory', 'development server', 'WSGI', 'request-response cycle']),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'routing',      'Routing',        'URL rules, dynamic segments, HTTP methods, URL building with url_for.', 2,  ARRAY['@app.route', 'URL parameters', 'converters', 'HTTP methods', 'url_for']),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'templates',    'Templates',      'Jinja2 templating, template inheritance, filters, and macros.', 3,  ARRAY['Jinja2', 'render_template', 'template inheritance', 'filters', 'macros', 'autoescape']),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'forms-input',  'Forms & Input',  'Handle form submissions, access request data, validate user input.', 4,  ARRAY['request.form', 'request.args', 'request.json', 'file uploads', 'flash messages']),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'database',     'Database',       'SQLAlchemy basics, define models, perform CRUD operations, run migrations.', 5,  ARRAY['Flask-SQLAlchemy', 'db.Model', 'db.session', 'CRUD', 'relationships', 'Flask-Migrate']),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'auth',         'Authentication', 'User sessions, login/logout, password hashing, login_required decorator.', 6,  ARRAY['Flask-Login', 'sessions', 'werkzeug.security', 'login_required', 'current_user']),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'rest-apis',    'REST APIs',      'Build JSON APIs, handle request parsing, error responses, and status codes.', 7,  ARRAY['jsonify', 'request.get_json', 'abort', 'error handlers', 'HTTP status codes']),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'blueprints',   'Blueprints',     'Organize large apps with blueprints, register URL prefixes, share templates.', 8,  ARRAY['Blueprint', 'register_blueprint', 'url_prefix', 'blueprint templates', 'app factory pattern']),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'testing',      'Testing',        'Write tests with pytest, use the test client, fixtures, and test configuration.', 9,  ARRAY['pytest', 'app.test_client', 'fixtures', 'test config', 'coverage']),
  ('b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'deployment',   'Deployment',     'Production setup with Gunicorn, environment config, logging, and common patterns.', 10, ARRAY['gunicorn', 'config classes', 'environment variables', 'logging', 'error pages'])
ON CONFLICT DO NOTHING;

INSERT INTO settings (key, value) VALUES
  ('learn.executionTimeoutSeconds', '30'),
  ('learn.executionMemoryMb', '128'),
  ('learn.maxConcurrent', '1'),
  ('learn.circuitBreakerThreshold', '5'),
  ('learn.circuitBreakerCooldownMin', '5'),
  ('learn.featureEnabled', 'true')
ON CONFLICT (key) DO NOTHING;
