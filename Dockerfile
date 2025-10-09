# Jekyll Development Environment for Chatsubo Blog
FROM ruby:3.1-alpine

# Install system dependencies
RUN apk add --no-cache \
    build-base \
    gcc \
    cmake \
    git \
    nodejs \
    npm

# Set working directory
WORKDIR /blog

# Copy Gemfile first for better caching
COPY Gemfile* ./

# Install Ruby dependencies
RUN bundle install

# Copy the rest of the blog content
COPY . .

# Expose port 5000
EXPOSE 5000

# Start Jekyll server
CMD ["bundle", "exec", "jekyll", "serve", "--host", "0.0.0.0", "--port", "5000", "--watch", "--drafts", "--livereload"]