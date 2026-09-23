FROM python:3.12-slim
WORKDIR /srv
COPY services/well-intel/requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt
COPY config /srv/config
COPY services/well-intel /srv/well-intel
ENV WELLS_RULES_PATH=/srv/config/well-status-rules.json
ENV WELLS_FIXTURE_PATH=/srv/well-intel/fixtures/cameron/raw_wells.json
ENV PYTHONPATH=/srv/well-intel
WORKDIR /srv/well-intel
EXPOSE 8088
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8088"]
